export type Rule = {
  type: string;
  pattern: RegExp;
  description: string;
};

export const coreRules: Rule[] = [
  {
    type: 'aws_access_key_id',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    description: 'AWS Access Key ID',
  },
  {
    type: 'github_pat',
    pattern: /\bghp_[A-Za-z0-9]{36}\b/g,
    description: 'GitHub Personal Access Token',
  },
  {
    type: 'github_token',
    pattern: /\bgho_[A-Za-z0-9]{36}\b/g,
    description: 'GitHub OAuth Token',
  },
  {
    type: 'slack_token',
    pattern: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}\b/g,
    description: 'Slack Token',
  },
  {
    type: 'stripe_secret_key',
    pattern: /\bsk_(live|test)_[0-9a-zA-Z]{24,}\b/g,
    description: 'Stripe Secret Key',
  },
  {
    type: 'openai_api_key',
    pattern: /\bsk-[A-Za-z0-9]{32,}\b/g,
    description: 'OpenAI API Key',
  },
];

export const highEntropyRule: Rule = {
  type: 'high_entropy',
  pattern: /\b[A-Za-z0-9_-]{32,}\b/g,
  description: 'High entropy token (optional)',
};
