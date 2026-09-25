import { ActionIcon, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import CodeBlock from '@tiptap/extension-code-block';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';

function FenceBlockView({ node, deleteNode }: NodeViewProps) {
  const language = typeof node.attrs.language === 'string' ? node.attrs.language : '';
  const isLog = language === 'log';

  return (
    <NodeViewWrapper
      as="pre"
      className={isLog ? 'tcm-log-block' : 'tcm-code-block'}
      data-type={isLog ? 'log' : undefined}
      spellCheck={false}
    >
      <div className="tcm-fence-delete" contentEditable={false}>
        <Tooltip label={isLog ? 'Удалить лог' : 'Удалить код'}>
          <ActionIcon
            color="red"
            variant="filled"
            size="sm"
            radius="xl"
            aria-label={isLog ? 'Удалить лог' : 'Удалить код'}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              deleteNode();
            }}
          >
            <IconTrash size={14} />
          </ActionIcon>
        </Tooltip>
      </div>
      <NodeViewContent<'code'> as="code" className={isLog ? 'language-log' : undefined} />
    </NodeViewWrapper>
  );
}

/** Code and log fences with a trash button that removes the whole block. */
export const DeletableCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FenceBlockView);
  },
});
