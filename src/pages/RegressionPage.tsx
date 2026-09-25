import { Button, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { FadeIn } from '@/components/ui/FadeIn';
import { regressionBrowsePath } from '@/routes/paths';

export function RegressionPage() {
  const navigate = useNavigate();

  return (
    <Stack gap="lg">
      <FadeIn>
        <div>
          <Title order={2}>Регресс</Title>
          <Text c="dimmed" mt="xs">
            Выберите список. Кейсы с обеими отметками попадут в оба списка по одному разу.
          </Text>
        </div>
      </FadeIn>

      <FadeIn delay={0.05}>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          <Button
            size="xl"
            variant="light"
            h={88}
            onClick={() => void navigate(regressionBrowsePath('suite'))}
          >
            Регресс
          </Button>
          <Button
            size="xl"
            variant="light"
            h={88}
            onClick={() => void navigate(regressionBrowsePath('task'))}
          >
            Регресс задачи
          </Button>
        </SimpleGrid>
      </FadeIn>
    </Stack>
  );
}
