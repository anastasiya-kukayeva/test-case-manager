import { Card, Group, Skeleton, Stack } from '@mantine/core';

/** Placeholder shown while app settings / recovery bootstrap. */
export function AppBootstrapSkeleton() {
  return (
    <Stack gap="lg" p="xl" maw={960} mx="auto" pt={80}>
      <Stack gap="xs">
        <Skeleton height={28} width={220} radius="sm" />
        <Skeleton height={14} width={360} radius="sm" />
      </Stack>

      <Group grow align="stretch">
        <Card withBorder padding="lg" radius="md">
          <Stack gap="md">
            <Skeleton height={18} width="40%" radius="sm" />
            <Skeleton height={12} radius="sm" />
            <Skeleton height={12} width="80%" radius="sm" />
            <Skeleton height={12} width="65%" radius="sm" />
            <Group gap="sm" mt="sm">
              <Skeleton height={32} width={110} radius="md" />
              <Skeleton height={32} width={110} radius="md" />
            </Group>
          </Stack>
        </Card>
        <Card withBorder padding="lg" radius="md">
          <Stack gap="md">
            <Skeleton height={18} width="50%" radius="sm" />
            <Skeleton height={12} radius="sm" />
            <Skeleton height={12} width="70%" radius="sm" />
            <Skeleton height={120} radius="md" />
          </Stack>
        </Card>
      </Group>

      <Card withBorder padding="lg" radius="md">
        <Stack gap="sm">
          <Skeleton height={16} width={180} radius="sm" />
          <Skeleton height={40} radius="md" />
          <Skeleton height={40} radius="md" />
          <Skeleton height={40} radius="md" />
        </Stack>
      </Card>
    </Stack>
  );
}

export function TablePageSkeleton() {
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Stack gap={6}>
          <Skeleton height={26} width={200} radius="sm" />
          <Skeleton height={12} width={280} radius="sm" />
        </Stack>
        <Group>
          <Skeleton height={36} width={140} radius="md" />
          <Skeleton height={36} width={160} radius="md" />
        </Group>
      </Group>
      <Skeleton height={120} radius="md" />
      <Skeleton height={280} radius="md" />
    </Stack>
  );
}
