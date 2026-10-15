import { Button, Group, Stack, Text, Title } from '@mantine/core';
import { IconFolderOpen, IconFolderPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectActions } from '@/application/project/projectActions';
import { CreateProjectModal } from '@/components/project/CreateProjectModal';
import { FadeIn } from '@/components/ui/FadeIn';
import { AppRoutes } from '@/routes/paths';

export function HomePage() {
  const navigate = useNavigate();
  const [createOpened, setCreateOpened] = useState(false);

  return (
    <Stack gap="lg">
      <FadeIn>
        <div>
          <Title order={2}>Test Case Manager</Title>
          <Text c="dimmed" mt="xs">
            Создавайте задачи, ведите тест-кейсы и экспортируйте результаты в Word.
          </Text>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <Group>
          <Button leftSection={<IconFolderPlus size={16} />} onClick={() => setCreateOpened(true)}>
            Новая задача
          </Button>
          <Button
            variant="light"
            leftSection={<IconFolderOpen size={16} />}
            onClick={() =>
              void projectActions.open().then((ok) => {
                if (ok) {
                  void navigate(AppRoutes.taskCurrent);
                }
              })
            }
          >
            Открыть задачу
          </Button>
        </Group>
      </FadeIn>

      <CreateProjectModal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        onCreated={() => void navigate(AppRoutes.taskCurrent)}
      />
    </Stack>
  );
}
