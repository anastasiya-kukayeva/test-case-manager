import { Button, Card, Group, Stack, Text, Title } from '@mantine/core';
import {
  IconChecklist,
  IconFileDescription,
  IconFolderOpen,
  IconFolderPlus,
  IconSettings,
} from '@tabler/icons-react';
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
          <Button
            variant="default"
            leftSection={<IconChecklist size={16} />}
            onClick={() => void navigate(AppRoutes.tasks)}
          >
            К задачам
          </Button>
          <Button
            variant="default"
            leftSection={<IconFileDescription size={16} />}
            onClick={() => void navigate(AppRoutes.allTestCases)}
          >
            Тест-кейсы
          </Button>
        </Group>
      </FadeIn>

      <FadeIn delay={0.08}>
        <Card withBorder padding="lg" radius="md" maw={420}>
          <Stack gap="sm">
            <Text fw={600}>Быстрые действия</Text>
            <Button
              variant="light"
              justify="flex-start"
              leftSection={<IconChecklist size={16} />}
              onClick={() => void navigate(AppRoutes.tasks)}
            >
              Управление задачами
            </Button>
            <Button
              variant="light"
              justify="flex-start"
              leftSection={<IconFileDescription size={16} />}
              onClick={() => void navigate(AppRoutes.allTestCases)}
            >
              Список тест-кейсов
            </Button>
            <Button
              variant="light"
              justify="flex-start"
              leftSection={<IconSettings size={16} />}
              onClick={() => void navigate(AppRoutes.settings)}
            >
              Настройки и экспорт
            </Button>
          </Stack>
        </Card>
      </FadeIn>

      <CreateProjectModal
        opened={createOpened}
        onClose={() => setCreateOpened(false)}
        onCreated={() => void navigate(AppRoutes.taskCurrent)}
      />
    </Stack>
  );
}
