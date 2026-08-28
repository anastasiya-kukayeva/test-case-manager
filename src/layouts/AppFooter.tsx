import { Box, Text } from '@mantine/core';

export function AppFooter() {
  return (
    <Box px="md" py="xs">
      <Text size="xs" c="dimmed">
        Test Case Manager v{__APP_VERSION__} · Electron + React + Vite
      </Text>
    </Box>
  );
}
