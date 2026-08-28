import { Accordion, Text } from '@mantine/core';
import type { ReactNode } from 'react';

type EditorSectionProps = {
  value: string;
  title: string;
  description?: string;
  children: ReactNode;
  rightSection?: ReactNode;
};

export function EditorSection({
  value,
  title,
  description,
  children,
  rightSection,
}: EditorSectionProps) {
  return (
    <Accordion.Item value={value}>
      <Accordion.Control>
        <div>
          <Text fw={600}>{title}</Text>
          {description ? (
            <Text size="xs" c="dimmed">
              {description}
            </Text>
          ) : null}
        </div>
      </Accordion.Control>
      <Accordion.Panel>
        {rightSection ? <div style={{ marginBottom: 12 }}>{rightSection}</div> : null}
        {children}
      </Accordion.Panel>
    </Accordion.Item>
  );
}
