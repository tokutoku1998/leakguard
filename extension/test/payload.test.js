"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const payload_1 = require("../src/payload");
describe('payload', () => {
    it('payload contains masked preview only', () => {
        const findings = [
            {
                type: 'openai_api_key',
                file: 'src/app.ts',
                line: 3,
                previewMasked: '[REDACTED]',
                fingerprint: 'abc123',
            },
        ];
        const payload = (0, payload_1.toPayload)(findings, 'repo', 'user');
        const body = JSON.stringify(payload);
        assert_1.default.ok(body.includes('[REDACTED]'));
        assert_1.default.ok(!body.includes('sk-'));
    });
});
//# sourceMappingURL=payload.test.js.map