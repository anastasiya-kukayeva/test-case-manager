import { ActionIcon, Tooltip } from '@mantine/core';
import { IconArrowsDiagonal2, IconTrash } from '@tabler/icons-react';
import Image from '@tiptap/extension-image';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { useCallback, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import {
  IMAGE_DISPLAY_WIDTH_DEFAULT,
  IMAGE_DISPLAY_WIDTH_MAX,
  IMAGE_DISPLAY_WIDTH_MIN,
  useImageCornerResize,
} from '@/components/editor/useImageCornerResize';

function parseWidth(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return undefined;
}

/** Place caret in a paragraph after the image (insert empty one if needed). */
function placeCaretAfterImage(editor: NodeViewProps['editor'], getPos: NodeViewProps['getPos'], nodeSize: number) {
  if (!editor || editor.isDestroyed) {
    return;
  }
  const pos = typeof getPos === 'function' ? getPos() : getPos;
  if (typeof pos !== 'number') {
    return;
  }

  const after = pos + nodeSize;
  const doc = editor.state.doc;
  const next = after < doc.content.size ? doc.nodeAt(after) : null;

  if (next?.isTextblock) {
    const selection = TextSelection.create(doc, after + 1);
    editor.view.dispatch(editor.state.tr.setSelection(selection).scrollIntoView());
    editor.view.focus();
    return;
  }

  editor
    .chain()
    .focus()
    .insertContentAt(after, { type: 'paragraph' })
    .setTextSelection(after + 1)
    .run();
}

function EditableImageView({
  node,
  updateAttributes,
  deleteNode,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  const src = typeof node.attrs.src === 'string' ? node.attrs.src : '';
  const alt = typeof node.attrs.alt === 'string' ? node.attrs.alt : 'screenshot';
  const imgRef = useRef<HTMLImageElement | null>(null);
  const storedWidth = parseWidth(node.attrs.width);
  const width = storedWidth ?? IMAGE_DISPLAY_WIDTH_DEFAULT;

  const onWidthChange = useCallback(
    (nextWidth: number) => {
      updateAttributes({ width: nextWidth });
    },
    [updateAttributes],
  );

  const { resizing, onResizePointerDown } = useImageCornerResize({
    width,
    onWidthChange,
    min: IMAGE_DISPLAY_WIDTH_MIN,
    max: IMAGE_DISPLAY_WIDTH_MAX,
  });

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const measured = Math.round(imgRef.current?.getBoundingClientRect().width ?? width);
    onResizePointerDown(event, measured);
  };

  const handleGutterMouseDown = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    placeCaretAfterImage(editor, getPos, node.nodeSize);
  };

  return (
    <NodeViewWrapper
      className={`tcm-rte-image-wrap${selected ? ' is-selected' : ''}${resizing ? ' is-resizing' : ''}`}
      data-drag-handle
    >
      <div className="tcm-rte-image-row">
        <div className="tcm-rte-image-frame">
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className="tcm-rte-image"
            draggable={false}
            style={{
              width: storedWidth ? `${storedWidth}px` : undefined,
              maxWidth: '100%',
              height: 'auto',
            }}
          />
          <Tooltip label="Удалить скриншот">
            <ActionIcon
              className="tcm-rte-image-delete"
              color="red"
              variant="filled"
              size="sm"
              radius="xl"
              aria-label="Удалить скриншот"
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
          <Tooltip label="Изменить размер">
            <button
              type="button"
              className="tcm-image-resize-handle"
              aria-label="Изменить размер изображения"
              onPointerDown={handleResizePointerDown}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <IconArrowsDiagonal2 size={12} stroke={2.2} />
            </button>
          </Tooltip>
        </div>
        <div
          className="tcm-rte-image-gutter"
          contentEditable={false}
          role="button"
          tabIndex={-1}
          aria-label="Поставить курсор после изображения"
          title="Кликните справа, чтобы писать под изображением"
          onMouseDown={handleGutterMouseDown}
        />
      </div>
    </NodeViewWrapper>
  );
}

/** TipTap image with hover delete, corner resize, and caret gutter to the right. */
export const DeletableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          const attr = element.getAttribute('width');
          if (attr) {
            const parsed = Number.parseFloat(attr);
            return Number.isFinite(parsed) ? parsed : null;
          }
          const styleWidth = element.style.width;
          if (styleWidth) {
            const parsed = Number.parseFloat(styleWidth);
            return Number.isFinite(parsed) ? parsed : null;
          }
          return null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) {
            return {};
          }
          return {
            width: String(attributes.width),
            style: `width: ${attributes.width}px; height: auto;`,
          };
        },
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { selection } = editor.state;
        if (!(selection instanceof NodeSelection) || selection.node.type.name !== 'image') {
          return false;
        }
        const after = selection.to;
        const next = after < editor.state.doc.content.size ? editor.state.doc.nodeAt(after) : null;
        if (next?.isTextblock) {
          editor.chain().focus().setTextSelection(after + 1).run();
          return true;
        }
        editor
          .chain()
          .focus()
          .insertContentAt(after, { type: 'paragraph' })
          .setTextSelection(after + 1)
          .run();
        return true;
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(EditableImageView);
  },
});
