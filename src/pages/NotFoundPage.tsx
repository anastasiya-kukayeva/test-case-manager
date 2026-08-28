import { Button, Stack, Text, Title } from '@mantine/core';
import { IconHome2 } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { FadeIn } from '@/components/ui/FadeIn';
import { AppRoutes } from '@/routes/paths';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <FadeIn>
      <Stack gap="md" maw={480}>
        <Title order={2}>Страница не найдена</Title>
        <Text c="dimmed">Запрошенный маршрут не существует или был перемещён.</Text>
        <Button
          w="fit-content"
          leftSection={<IconHome2 size={16} />}
          onClick={() => void navigate(AppRoutes.home)}
        >
          На главную
        </Button>
      </Stack>
    </FadeIn>
  );
}
