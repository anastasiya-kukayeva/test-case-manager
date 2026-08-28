import { Alert, Button, Code, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { notifyError } from '@/application/errors/errorHandler';
import { AppError } from '@/application/errors/AppError';

type ErrorBoundaryProps = {
  children: ReactNode;
  title?: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    notifyError(
      new AppError('UNKNOWN', error.message || 'Необработанная ошибка интерфейса', {
        details: info.componentStack,
        cause: error,
      }),
      { title: 'Сбой интерфейса', showNotification: true },
    );
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <Stack gap="md" p="md" maw={560}>
        <Alert
          color="red"
          icon={<IconAlertTriangle size={18} />}
          title={this.props.title ?? 'Что-то пошло не так'}
        >
          <Text size="sm" mb="xs">
            Произошла непредвиденная ошибка. Можно попробовать продолжить или перезагрузить
            приложение.
          </Text>
          <Code block style={{ whiteSpace: 'pre-wrap' }}>
            {error.message}
          </Code>
        </Alert>
        <GroupButtons onReset={this.handleReset} onReload={this.handleReload} />
      </Stack>
    );
  }
}

function GroupButtons({ onReset, onReload }: { onReset: () => void; onReload: () => void }) {
  return (
    <Stack gap="sm">
      <Button variant="light" onClick={onReset}>
        Попробовать снова
      </Button>
      <Button leftSection={<IconRefresh size={16} />} onClick={onReload}>
        Перезагрузить
      </Button>
      <Title order={6} c="dimmed" fw={400}>
        Если ошибка повторяется — сохраните задачу (Ctrl+S) перед перезагрузкой.
      </Title>
    </Stack>
  );
}
