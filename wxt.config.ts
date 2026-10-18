import { defineConfig } from 'wxt';

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Yardmaster',
    description:
      'Multiline inputs, computed dropdowns and folders for GitHub Actions. github.com only, no tokens, no telemetry.',
    // Only to remember which sidebar folders you collapsed.
    permissions: ['storage'],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'yardmaster@fladioarmandika',
          strict_min_version: '128.0',
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
