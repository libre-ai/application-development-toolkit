# SPDX-FileCopyrightText: 2026 Libre AI contributors
# SPDX-License-Identifier: Apache-2.0
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SCRIPT = Path(__file__).with_name('summarize-e2e-failures.py')
SECRET = 'SENTINEL_PRIVATE_COOKIE_TOKEN_BODY'


class TraceSummary(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('summary', SCRIPT)
        self.summary = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.summary)
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name) / 'test-results'
        self.root.mkdir()

    def archive(self, events=None, network=None, extra=None, compression=zipfile.ZIP_STORED):
        folder = self.root / SECRET
        folder.mkdir(exist_ok=True)
        path = folder / 'trace.zip'
        with zipfile.ZipFile(path, 'w', compression=compression) as archive:
            archive.writestr('0-trace.trace', '\n'.join(json.dumps(x) for x in events or [{'type': 'context-options', 'wallTime': SECRET}]))
            if network is not None:
                archive.writestr('0-trace.network', '\n'.join(json.dumps(x) for x in network))
            for name, value in (extra or {}).items():
                archive.writestr(name, value)
        return path

    def run_cli(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = self.summary.main(['--results', str(self.root)])
        text = output.getvalue()
        self.assertNotIn(SECRET, text)
        self.assertNotIn(str(self.root), text)
        return code, json.loads(text)

    def test_only_allowlisted_fields_leave_the_archive(self):
        events = [
            {'type': 'before', 'callId': SECRET, 'class': 'Frame', 'method': 'goto', 'startTime': 1000, 'params': {'url': SECRET}, 'title': SECRET},
            {'type': 'after', 'callId': SECRET, 'endTime': 1200, 'result': SECRET, 'error': {'message': 'Object with guid response@' + SECRET + ' was not bound in the connection'}},
            {'type': 'error', 'error': {'message': 'expect(locator).toBeVisible() failed ' + SECRET}},
            {'type': 'error', 'error': {'name': 'TimeoutError', 'message': SECRET}},
            {'type': 'stdout', 'text': SECRET},
        ]
        network = [{'type': 'resource-snapshot', 'snapshot': {'_monotonicTime': 1050, 'time': 30, 'request': {'url': 'https://user:' + SECRET + '@issuer.invalid/v1/auth/callback?code=' + SECRET, 'method': 'GET', 'headers': [SECRET], 'postData': SECRET}, 'response': {'status': 400, 'headers': [SECRET], 'content': {'text': SECRET}}}}]
        self.archive(events, network, {'resources/' + SECRET: SECRET})
        original = zipfile.ZipFile.open
        def read_only_events(archive, name, *args, **kwargs):
            filename = name.filename if isinstance(name, zipfile.ZipInfo) else name
            self.assertFalse(filename.startswith('resources/'), 'Resource bodies must never be read')
            return original(archive, name, *args, **kwargs)
        with patch.object(zipfile.ZipFile, 'open', read_only_events):
            code, result = self.run_cli()
        self.assertEqual(code, 0)
        self.assertEqual(set(result), {'schemaVersion', 'status', 'scenarios'})
        row = result['scenarios'][0]
        self.assertRegex(row['scenarioId'], r'^[0-9a-f]{64}$')
        self.assertEqual(row['errors'], {'timeout': 1, 'assertion': 1, 'guid': 1, 'unclassified': 0})
        self.assertEqual(row['operations'], [{'class': 'Frame', 'method': 'goto', 'startMs': 0, 'durationMs': 200, 'errorCategory': 'guid'}])
        self.assertEqual(row['network'], [{'endpoint': '/v1/auth/callback', 'method': 'GET', 'status': 400, 'startMs': 50, 'durationMs': 30}])

    def test_unknown_urls_methods_and_operations_are_not_echoed(self):
        self.archive([{'type': 'before', 'callId': 'x', 'class': SECRET, 'method': SECRET, 'startTime': 1}], [{'type': 'resource-snapshot', 'snapshot': {'_monotonicTime': 2, 'time': 3, 'request': {'url': 'https://example.invalid/' + SECRET, 'method': SECRET}, 'response': {'status': 200}}}])
        code, result = self.run_cli()
        self.assertEqual(code, 0)
        self.assertEqual(result['scenarios'][0]['network'], [])
        self.assertEqual(result['scenarios'][0]['operations'], [])

    def test_assertion_with_locator_timeout_remains_an_assertion(self):
        self.archive([
            {'type': 'error', 'error': {'message': 'Error: expect(locator).toBeDisabled() failed\nTimeout: 5000ms\n' + SECRET}},
            {'type': 'error', 'error': {'message': 'Test timeout of 30000ms exceeded. ' + SECRET}},
            {'type': 'error', 'error': {'name': 'AssertionError', 'message': 'Timeout 5000ms ' + SECRET}},
        ])
        code, result = self.run_cli()
        self.assertEqual(code, 0)
        self.assertEqual(result['scenarios'][0]['errors'], {'timeout': 1, 'assertion': 2, 'guid': 0, 'unclassified': 0})

    def test_missing_after_is_explicit_without_inventing_duration(self):
        self.archive([{'type': 'before', 'callId': 'x', 'class': 'Frame', 'method': 'expect', 'startTime': 10}])
        code, result = self.run_cli()
        self.assertEqual(code, 0)
        self.assertIsNone(result['scenarios'][0]['operations'][0]['durationMs'])

    def test_malformed_json_and_duplicate_keys_refuse_without_echo(self):
        for raw in [SECRET, '{"type":"error","type":"stdout"}']:
            path = self.archive()
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('test.trace', raw)
            code, result = self.run_cli()
            self.assertEqual(code, 2)
            self.assertEqual(result['scenarios'][0]['reason'], 'invalid-format')

    def test_zip_bomb_ratio_and_uncompressed_limit_refuse(self):
        self.archive(extra={'resources/body': 'x' * 100_000}, compression=zipfile.ZIP_DEFLATED)
        code, result = self.run_cli()
        self.assertEqual(code, 2)
        self.assertEqual(result['scenarios'][0]['reason'], 'archive-limit')
        self.archive(extra={'resources/body': 'x' * 100})
        with patch.object(self.summary, 'MAX_TOTAL_BYTES', 50):
            code, result = self.run_cli()
        self.assertEqual(code, 2)
        self.assertEqual(result['scenarios'][0]['reason'], 'archive-limit')

    def test_archive_and_event_count_limits_refuse(self):
        self.archive([{'type': 'context-options'}] * 3)
        with patch.object(self.summary, 'MAX_EVENTS', 2):
            code, result = self.run_cli()
        self.assertEqual(code, 2)
        with patch.object(self.summary, 'MAX_ARCHIVE_BYTES', 1):
            code, result = self.run_cli()
        self.assertEqual(code, 2)

    def test_member_count_is_checked_before_zipfile_parses_directory(self):
        self.archive(extra={'one': '', 'two': ''})
        with patch.object(self.summary, 'MAX_MEMBERS', 2), patch.object(zipfile, 'ZipFile', side_effect=AssertionError('must refuse first')):
            code, result = self.run_cli()
        self.assertEqual(code, 2)
        self.assertEqual(result['scenarios'][0]['reason'], 'archive-limit')

    def test_unsafe_archive_members_and_symlink_scenarios_refuse(self):
        self.archive(extra={'../' + SECRET: SECRET})
        code, result = self.run_cli()
        self.assertEqual(code, 2)
        self.assertEqual(result['scenarios'][0]['reason'], 'invalid-archive')
        link = self.root / 'link'
        link.symlink_to(self.root / SECRET, target_is_directory=True)
        code, result = self.run_cli()
        self.assertEqual(code, 2)
        self.assertTrue(any(row.get('reason') == 'unsafe-path' for row in result['scenarios']))

    def test_failed_network_and_exact_assets_have_only_safe_categories(self):
        failures = [('net::ERR_CERT_AUTHORITY_INVALID', 'certificate'), ('ECONNREFUSED', 'refused'), ('ECONNRESET', 'reset'), ('net::ERR_ABORTED', 'aborted'), ('TIMEOUT', 'timeout'), (SECRET, 'other')]
        events = []
        for index, (text, _) in enumerate(failures):
            events.append({'type': 'resource-snapshot', 'snapshot': {'_monotonicTime': 100 + index, 'time': -1, 'request': {'url': 'https://example.invalid/assets/app.js?secret=' + SECRET, 'method': 'GET'}, 'response': {'status': -1, '_failureText': text + ' ' + SECRET}}})
        events.append({'type': 'resource-snapshot', 'snapshot': {'_monotonicTime': 110, 'time': 2, 'request': {'url': 'https://example.invalid/assets/styles.css', 'method': 'GET'}, 'response': {'status': 200}}})
        self.archive(network=events)
        code, result = self.run_cli()
        self.assertEqual(code, 0)
        rows = result['scenarios'][0]['network']
        self.assertEqual([row['failureCategory'] for row in rows[:-1]], [category for _, category in failures])
        self.assertTrue(all(row['durationMs'] is None and row['status'] is None for row in rows[:-1]))
        self.assertEqual(rows[-1]['endpoint'], '/assets/styles.css')

    def test_forged_central_directory_count_refuses_before_zipfile(self):
        import struct
        path = self.archive()
        raw = bytearray(path.read_bytes())
        offset = raw.rfind(b'PK\x05\x06')
        struct.pack_into('<2H', raw, offset + 8, 0, 0)
        path.write_bytes(raw)
        with patch.object(zipfile, 'ZipFile', side_effect=AssertionError('must refuse first')):
            code, result = self.run_cli()
        self.assertEqual(code, 2)
        self.assertEqual(result['scenarios'][0]['reason'], 'invalid-archive')

    def test_fifo_archive_refuses_without_blocking_or_echoing_path(self):
        import os
        import subprocess
        import sys
        folder = self.root / SECRET
        folder.mkdir()
        os.mkfifo(folder / 'trace.zip')
        result = subprocess.run(
            [sys.executable, str(SCRIPT), '--results', str(self.root)],
            capture_output=True, text=True, timeout=2,
        )
        self.assertEqual(result.returncode, 2)
        self.assertEqual(result.stderr, '')
        self.assertNotIn(SECRET, result.stdout)
        self.assertNotIn(str(self.root), result.stdout)
        parsed = json.loads(result.stdout)
        self.assertEqual(parsed['scenarios'][0]['reason'], 'unsafe-path')

    def test_missing_results_and_unknown_arguments_are_safe_refusals(self):
        self.root.rmdir()
        code, result = self.run_cli()
        self.assertEqual(code, 2)
        self.assertEqual(result['reason'], 'missing-results')
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            code = self.summary.main([SECRET])
        self.assertEqual(code, 2)
        self.assertNotIn(SECRET, output.getvalue())

    def test_invalid_time_and_line_limit_refuse(self):
        self.archive([{'type': 'before', 'callId': 'x', 'class': 'Frame', 'method': 'goto', 'startTime': float('nan')}])
        code, result = self.run_cli()
        self.assertEqual(code, 2)
        self.archive()
        with patch.object(self.summary, 'MAX_LINE_BYTES', 8):
            code, result = self.run_cli()
        self.assertEqual(code, 2)


if __name__ == '__main__':
    unittest.main()
