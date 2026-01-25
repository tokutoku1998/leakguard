"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const masking_1 = require("../src/masking");
describe('masking', () => {
    it('maskPreview redacts known match', () => {
        const line = 'const key = "sk-live-1234567890abcdef12345678";';
        const preview = (0, masking_1.maskPreview)(line, 'sk-live-1234567890abcdef12345678');
        assert_1.default.ok(!preview.includes('sk-live-1234567890abcdef12345678'));
        assert_1.default.ok(preview.includes('[REDACTED]'));
    });
    it('fingerprint is stable', () => {
        const fp1 = (0, masking_1.makeFingerprint)(['type', 'file', '1', 'preview']);
        const fp2 = (0, masking_1.makeFingerprint)(['type', 'file', '1', 'preview']);
        assert_1.default.strictEqual(fp1, fp2);
    });
});
//# sourceMappingURL=masking.test.js.map