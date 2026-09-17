# SPDX-FileCopyrightText: 2026 Libre AI contributors
# SPDX-License-Identifier: Apache-2.0
"""Summarize bounded Playwright traces without exposing captured user data."""
import hashlib
import json
import math
import os
from pathlib import PurePosixPath
import re
import stat
import struct
import sys
from urllib.parse import urlsplit
import zipfile

MAX_ARCHIVES = 32
MAX_DIRECTORY_ENTRIES = 128
MAX_ARCHIVE_BYTES = 32 * 1024 * 1024
MAX_MEMBERS = 512
MAX_MEMBER_BYTES = 16 * 1024 * 1024
MAX_TOTAL_BYTES = 64 * 1024 * 1024
MAX_RATIO = 100
MAX_LINE_BYTES = 1024 * 1024
MAX_EVENTS = 50_000
MAX_OUTPUT_EVENTS = 2048
MAX_SPAN_MS = 24 * 60 * 60 * 1000
ENDPOINTS = frozenset(('/', '/api/session', '/api/notes', '/e2e/csrf', '/v1/auth/login', '/v1/auth/callback', '/api/schemas', '/api/validate', '/assets/app.js', '/assets/styles.css'))
METHODS = frozenset(('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'))
OPERATIONS = {
    'Frame': frozenset(('goto', 'click', 'fill', 'expect', 'waitForSelector', 'waitForTimeout', 'waitForLoadState', 'evaluateExpression', 'evaluateExpressionHandle')),
    'Page': frozenset(('reload', 'close', 'screenshot', 'setViewportSize')),
    'BrowserContext': frozenset(('newPage', 'close')),
    'APIRequestContext': frozenset(('fetch',)),
}
EVENT_TYPES = frozenset(('context-options', 'before', 'after', 'input', 'log', 'event', 'error', 'stdout', 'stderr', 'console', 'resource-snapshot', 'frame-snapshot', 'screencast-frame'))


class Refusal(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Refusal(reason)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'invalid-format')
        result[key] = value
    return result


def number(value):
    require(type(value) in (int, float) and math.isfinite(value) and 0 <= value <= 10**15, 'invalid-format')
    return value


def error_category(error):
    if not isinstance(error, dict):
        return 'unclassified'
    message = error.get('message', '')
    if not isinstance(message, str):
        return 'unclassified'
    if 'Object with guid ' in message and 'was not bound in the connection' in message:
        return 'guid'
    if error.get('name') == 'AssertionError' or ('expect(' in message and 'failed' in message):
        return 'assertion'
    if error.get('name') == 'TimeoutError' or re.search(r'\b(?:Timeout|timeout|timed out)\b', message):
        return 'timeout'
    return 'unclassified'


def failure_category(text):
    if not isinstance(text, str):
        return 'other'
    upper = text.upper()
    for category, tokens in (
        ('certificate', ('CERT_', 'CERTIFICATE', 'SSL_')),
        ('refused', ('CONNECTION_REFUSED', 'ECONNREFUSED')),
        ('reset', ('CONNECTION_RESET', 'ECONNRESET')),
        ('aborted', ('ABORTED', 'CANCELLED', 'CANCELED')),
        ('timeout', ('TIMED_OUT', 'TIMEOUT')),
    ):
        if any(token in upper for token in tokens):
            return category
    return 'other'


def check_zip_directory(stream):
    size = os.fstat(stream.fileno()).st_size
    require(22 <= size <= MAX_ARCHIVE_BYTES, 'archive-limit')
    stream.seek(max(0, size - 65557))
    tail = stream.read(65557)
    offset = tail.rfind(b'PK\x05\x06')
    require(offset >= 0 and len(tail) - offset >= 22, 'invalid-archive')
    _, disk, central_disk, disk_entries, entries, central_size, central_offset, comment_size = struct.unpack_from('<4s4H2LH', tail, offset)
    require(disk == central_disk == 0 and disk_entries == entries, 'invalid-archive')
    require(entries <= MAX_MEMBERS and entries != 65535, 'archive-limit')
    require(central_size != 0xFFFFFFFF and central_offset != 0xFFFFFFFF, 'archive-limit')
    require(offset + 22 + comment_size == len(tail) and central_offset + central_size <= size - 22, 'invalid-archive')
    # zipfile parses the central directory into Python objects. Bound and count
    # it first, including forged EOCD entry counts, before allocating that list.
    require(central_size <= MAX_MEMBERS * 1024, 'archive-limit')
    stream.seek(central_offset)
    central = stream.read(central_size)
    cursor = 0
    count = 0
    while cursor < len(central):
        require(central[cursor:cursor + 4] == b'PK\x01\x02' and cursor + 46 <= len(central), 'invalid-archive')
        name_size, extra_size, entry_comment_size = struct.unpack_from('<3H', central, cursor + 28)
        cursor += 46 + name_size + extra_size + entry_comment_size
        count += 1
        require(count <= MAX_MEMBERS, 'archive-limit')
    require(cursor == len(central) and count == entries, 'invalid-archive')
    stream.seek(0)


def summarize_archive(stream):
    check_zip_directory(stream)
    operations, after, network = {}, {}, []
    errors = {'timeout': 0, 'assertion': 0, 'guid': 0, 'unclassified': 0}
    events = 0
    total_bytes = 0
    trace_found = False
    coverage = {
        'traceMembersRead': 0, 'networkMembersRead': 0,
        'traceMembersIgnored': 0, 'networkMembersIgnored': 0,
        'browserEventsSeen': 0, 'networkEventsSeen': 0,
        'browserCoverage': 'not-observed',
    }
    with zipfile.ZipFile(stream) as archive:
        members = archive.infolist()
        require(len(members) <= MAX_MEMBERS, 'archive-limit')
        names = set()
        for member in members:
            path = PurePosixPath(member.filename)
            require(member.filename not in names and not path.is_absolute() and '..' not in path.parts and '\\' not in member.filename, 'invalid-archive')
            names.add(member.filename)
            require(not stat.S_ISLNK(member.external_attr >> 16) and not member.flag_bits & 1, 'invalid-archive')
            total_bytes += member.file_size
            require(member.file_size <= MAX_MEMBER_BYTES and total_bytes <= MAX_TOTAL_BYTES, 'archive-limit')
            require(member.file_size <= max(1, member.compress_size) * MAX_RATIO, 'archive-limit')
            require(member.compress_type in (zipfile.ZIP_STORED, zipfile.ZIP_DEFLATED), 'invalid-archive')
        for member in members:
            # Never open resource bodies, screenshots, source files or attachments.
            member_kind = None
            if member.filename.endswith('.trace'):
                member_kind = 'trace'
            elif member.filename.endswith('.network'):
                member_kind = 'network'
            if '/' in member.filename or not re.fullmatch(r'[A-Za-z0-9_-]+\.(trace|network)', member.filename):
                if member_kind is not None:
                    coverage[member_kind + 'MembersIgnored'] += 1
                continue
            is_trace = member_kind == 'trace'
            trace_found |= is_trace
            coverage[member_kind + 'MembersRead'] += 1
            browser_stream = False
            with archive.open(member) as lines:
                while True:
                    raw = lines.readline(MAX_LINE_BYTES + 1)
                    if not raw:
                        break
                    require(len(raw) <= MAX_LINE_BYTES, 'event-limit')
                    events += 1
                    require(events <= MAX_EVENTS, 'event-limit')
                    event = json.loads(raw, object_pairs_hook=unique_object, parse_constant=lambda _: (_ for _ in ()).throw(Refusal('invalid-format')))
                    require(type(event) is dict and event.get('type') in EVENT_TYPES, 'invalid-format')
                    kind = event['type']
                    if kind == 'context-options':
                        browser_stream = event.get('origin') == 'library' and event.get('browserName') in ('chromium', 'firefox', 'webkit')
                    elif browser_stream:
                        coverage['browserEventsSeen'] += 1
                    if kind == 'before':
                        pair = (event.get('class'), event.get('method'))
                        if pair[0] not in OPERATIONS or pair[1] not in OPERATIONS[pair[0]]:
                            continue
                        call = event.get('callId')
                        require(type(call) is str and call not in operations, 'invalid-format')
                        operations[call] = {'class': pair[0], 'method': pair[1], 'startMs': number(event.get('startTime')), 'durationMs': None, 'errorCategory': None}
                    elif kind == 'after':
                        call = event.get('callId')
                        require(type(call) is str and call not in after, 'invalid-format')
                        end = number(event.get('endTime'))
                        category = error_category(event['error']) if event.get('error') is not None else None
                        after[call] = (end, category)
                        if category is not None:
                            errors[category] += 1
                    elif kind == 'error':
                        # The test runner uses top-level message; action errors are nested.
                        error = event.get('error')
                        if not isinstance(error, dict):
                            error = {'message': event.get('message')}
                        errors[error_category(error)] += 1
                    elif kind == 'resource-snapshot':
                        coverage['networkEventsSeen'] += 1
                        snapshot = event.get('snapshot')
                        require(type(snapshot) is dict and type(snapshot.get('request')) is dict and type(snapshot.get('response')) is dict, 'invalid-format')
                        request, response = snapshot['request'], snapshot['response']
                        require(type(request.get('url')) is str, 'invalid-format')
                        url = urlsplit(request['url'])
                        if url.scheme not in ('http', 'https') or url.path not in ENDPOINTS or request.get('method') not in METHODS:
                            continue
                        status = response.get('status')
                        require(type(status) is int and -1 <= status <= 599, 'invalid-format')
                        row = {'endpoint': url.path, 'method': request['method'], 'status': None if status == -1 else status, 'startMs': number(snapshot.get('_monotonicTime')), 'durationMs': None if snapshot.get('time') == -1 else number(snapshot.get('time'))}
                        if response.get('_failureText') is not None:
                            row['failureCategory'] = failure_category(response['_failureText'])
                        network.append(row)
                    require(len(operations) + len(network) <= MAX_OUTPUT_EVENTS, 'event-limit')
    require(trace_found and events > 0, 'invalid-format')
    for call, operation in operations.items():
        if call in after:
            end, category = after[call]
            require(end >= operation['startMs'], 'invalid-format')
            operation['durationMs'] = end - operation['startMs']
            operation['errorCategory'] = category
    output_operations = list(operations.values())
    timed = output_operations + network
    origin = min((row['startMs'] for row in timed), default=0)
    for row in timed:
        row['startMs'] -= origin
        require(row['startMs'] <= MAX_SPAN_MS and (row['durationMs'] is None or row['durationMs'] <= MAX_SPAN_MS), 'event-limit')
        row['startMs'] = round(row['startMs'], 3)
        if row['durationMs'] is not None:
            row['durationMs'] = round(row['durationMs'], 3)
    # Observed events do not establish complete browser or network coverage.
    if coverage['browserEventsSeen'] > 0:
        coverage['browserCoverage'] = 'observed'
    return {'status': 'summarized', 'errors': errors, 'operations': output_operations, 'network': network, 'coverage': coverage}


def summarize_results(root):
    flags = os.O_RDONLY | os.O_NOFOLLOW
    directory_flags = flags | os.O_DIRECTORY
    scenarios = []
    root_fd = os.open(root, directory_flags)
    try:
        with os.scandir(root_fd) as entries:
            names = []
            for entry in entries:
                require(len(names) < MAX_DIRECTORY_ENTRIES, 'directory-limit')
                names.append(entry.name)
        for name in sorted(names):
            info = os.stat(name, dir_fd=root_fd, follow_symlinks=False)
            if not stat.S_ISDIR(info.st_mode) and not stat.S_ISLNK(info.st_mode):
                continue
            require(len(scenarios) < MAX_ARCHIVES, 'archive-limit')
            scenario_id = hashlib.sha256(name.encode()).hexdigest()
            try:
                require(not stat.S_ISLNK(info.st_mode), 'unsafe-path')
                child_fd = os.open(name, directory_flags, dir_fd=root_fd)
                try:
                    descriptor = os.open('trace.zip', flags | os.O_NONBLOCK, dir_fd=child_fd)
                finally:
                    os.close(child_fd)
                with os.fdopen(descriptor, 'rb') as stream:
                    require(stat.S_ISREG(os.fstat(stream.fileno()).st_mode), 'unsafe-path')
                    summary = summarize_archive(stream)
            except Refusal as error:
                summary = {'status': 'rejected', 'reason': str(error)}
            except Exception:
                summary = {'status': 'rejected', 'reason': 'invalid-format'}
            scenarios.append({'scenarioId': scenario_id, **summary})
    finally:
        os.close(root_fd)
    require(scenarios, 'missing-traces')
    return {'schemaVersion': 'e2e-failure-summary.v1', 'status': 'rejected' if any(row['status'] == 'rejected' for row in scenarios) else 'summarized', 'scenarios': scenarios}


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    try:
        require(not argv or (len(argv) == 2 and argv[0] == '--results'), 'invalid-arguments')
        root = argv[1] if argv else 'test-results'
        result = summarize_results(root)
    except Refusal as error:
        result = {'schemaVersion': 'e2e-failure-summary.v1', 'status': 'rejected', 'reason': str(error), 'scenarios': []}
    except OSError:
        result = {'schemaVersion': 'e2e-failure-summary.v1', 'status': 'rejected', 'reason': 'missing-results', 'scenarios': []}
    except Exception:
        result = {'schemaVersion': 'e2e-failure-summary.v1', 'status': 'rejected', 'reason': 'invalid-format', 'scenarios': []}
    print(json.dumps(result, sort_keys=True, allow_nan=False))
    return 0 if result['status'] == 'summarized' else 2


if __name__ == '__main__':
    raise SystemExit(main())
