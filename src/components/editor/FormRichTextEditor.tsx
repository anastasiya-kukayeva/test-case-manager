import { ActionIcon, FileButton, Group, Tooltip } from '@mantine/core';
import {
  IconBold,
  IconCode,
  IconFileText,
  IconIndentDecrease,
  IconIndentIncrease,
  IconItalic,
  IconList,
  IconListNumbers,
  IconPhotoPlus,
  IconUnderline,
} from '@tabler/icons-react';
import CodeBlock from '@tiptap/extension-code-block';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useMemo, useRef, useState } from 'react';
import { PhotoSlider } from 'react-photo-view';
import { extractImageFilesFromClipboard } from '@/application/testCases/screenshotHelpers';
import { DeletableImage } from '@/components/editor/DeletableImage';
import {
  canSinkListItem,
  NestedListItem,
} from '@/components/editor/nestedListItem';
import { RichTextColorControls } from '@/components/editor/RichTextColorControls';
import { toggleFenceBlock } from '@/components/editor/toggleFenceBlock';
import type { RichTextContent } from '@/domain/types';
import 'react-photo-view/dist/react-photo-view.css';
import '@/components/editor/formRichTextEditor.css';

type FormRichTextEditorProps = {
  value: RichTextContent;
  onChange: (value: RichTextContent) => void;
  placeholder?: string;
  minHeight?: number;
  /** When set, content scrolls inside the editor and the toolbar stays pinned on top. */
  maxHeight?: number;
  error?: string;
  allowImages?: boolean;
  allowCodeAndLogs?: boolean;
};

function htmlToPlainText(html: string): string {
  const temporary = document.createElement('div');
  temporary.innerHTML = html;
  return temporary.textContent?.replace(/\u00a0/g, ' ').trim() ?? '';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

async function insertImageFiles(editor: Editor | null | undefined, files: File[]) {
  if (!editor || editor.isDestroyed || files.length === 0) {
    return;
  }
  for (const file of files) {
    if (!file.type.startsWith('image/') || editor.isDestroyed) {
      continue;
    }
    const src = await readFileAsDataUrl(file);
    if (editor.isDestroyed) {
      return;
    }
    // Prefer setImage so list structure (li nesting) is preserved.
    const inserted = editor
      .chain()
      .focus()
      .setImage({ src, alt: file.name || 'screenshot' })
      .run();
    if (!inserted) {
      continue;
    }
    const { selection } = editor.state;
    const after = selection.to;
    const next = after < editor.state.doc.content.size ? editor.state.doc.nodeAt(after) : null;
    if (!next?.isTextblock) {
      editor.chain().focus().insertContentAt(after, { type: 'paragraph' }).setTextSelection(after + 1).run();
    }
  }
}

function collectEditorImageSrcs(editor: Editor): string[] {
  const srcs: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'image' && typeof node.attrs.src === 'string' && node.attrs.src) {
      srcs.push(node.attrs.src);
    }
  });
  return srcs;
}

function createExtensions(placeholder: string) {
  // TipTap: never reuse extension instances across different editors.
  return [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      listItem: false,
    }),
    NestedListItem,
    Underline,
    TextStyle,
    Color,
    Highlight.configure({
      multicolor: true,
      HTMLAttributes: {
        class: 'tcm-rte-highlight',
      },
    }),
    CodeBlock.configure({
      HTMLAttributes: {
        class: 'tcm-code-block',
        spellcheck: 'false',
      },
    }),
    DeletableImage.configure({
      allowBase64: true,
      inline: false,
      HTMLAttributes: {
        class: 'tcm-rte-image',
      },
    }),
    Placeholder.configure({ placeholder }),
  ];
}

export function FormRichTextEditor({
  value,
  onChange,
  placeholder = 'Введите текст…',
  minHeight = 140,
  maxHeight,
  error,
  allowImages = false,
  allowCodeAndLogs = false,
}: FormRichTextEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const allowImagesRef = useRef(allowImages);
  allowImagesRef.current = allowImages;

  const editorRef = useRef<Editor | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxImages, setLightboxImages] = useState<Array<{ src: string; key: string }>>([]);

  const extensions = useMemo(() => createExtensions(placeholder), [placeholder]);

  const openImageLightbox = (src: string) => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) {
      return;
    }
    const srcs = collectEditorImageSrcs(editor);
    const index = Math.max(0, srcs.indexOf(src));
    setLightboxImages(srcs.map((item, i) => ({ src: item, key: String(i) })));
    setLightboxIndex(index >= 0 ? index : 0);
    setLightboxOpen(true);
  };

  const editor = useEditor(
    {
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      extensions,
      content: value.html || '',
      editorProps: {
        attributes: {
          class: `tcm-rte-prose${allowImages ? ' tcm-rte-prose--zoomable-images' : ''}`,
          style: `min-height: ${minHeight}px`,
        },
        handleClickOn: (_view, _pos, node, _nodePos, event) => {
          if (!allowImagesRef.current || node.type.name !== 'image') {
            return false;
          }
          const target = event.target;
          if (!(target instanceof Element) || !target.closest('img.tcm-rte-image')) {
            return false;
          }
          if (
            target.closest(
              '.tcm-rte-image-gutter, .tcm-image-resize-handle, .tcm-rte-image-actions, .tcm-rte-image-delete',
            )
          ) {
            return false;
          }
          const src = typeof node.attrs.src === 'string' ? node.attrs.src : '';
          if (!src) {
            return false;
          }
          event.preventDefault();
          openImageLightbox(src);
          return true;
        },
        handlePaste: (_view, event) => {
          if (!allowImagesRef.current) {
            return false;
          }
          const files = extractImageFilesFromClipboard(event.clipboardData);
          if (files.length === 0) {
            return false;
          }
          event.preventDefault();
          void insertImageFiles(editorRef.current, files);
          return true;
        },
        handleDrop: (_view, event) => {
          if (!allowImagesRef.current) {
            return false;
          }
          const files = Array.from(event.dataTransfer?.files ?? []).filter((file) =>
            file.type.startsWith('image/'),
          );
          if (files.length === 0) {
            return false;
          }
          event.preventDefault();
          void insertImageFiles(editorRef.current, files);
          return true;
        },
      },
      onUpdate: ({ editor: current }) => {
        if (current.isDestroyed) {
          return;
        }
        const html = current.getHTML();
        onChangeRef.current({
          html: html === '<p></p>' ? '' : html,
          plainText: htmlToPlainText(html),
        });
      },
    },
    [extensions, allowImages],
  );

  editorRef.current = editor;

  const toolbarState = useEditorState({
    editor,
    selector: ({ editor: current }) => {
      if (!current || current.isDestroyed) {
        return {
          bold: false,
          italic: false,
          underline: false,
          bulletList: false,
          orderedList: false,
          canSink: false,
          canLift: false,
          code: false,
          log: false,
          color: null as string | null,
          highlight: null as string | null,
        };
      }
      const textColor = current.getAttributes('textStyle').color;
      const highlightColor = current.getAttributes('highlight').color;
      return {
        bold: current.isActive('bold'),
        italic: current.isActive('italic'),
        underline: current.isActive('underline'),
        bulletList: current.isActive('bulletList'),
        orderedList: current.isActive('orderedList'),
        canSink: canSinkListItem(current),
        canLift: current.can().liftListItem('listItem'),
        code: current.isActive('codeBlock') && !current.isActive('codeBlock', { language: 'log' }),
        log: current.isActive('codeBlock', { language: 'log' }),
        color: typeof textColor === 'string' && textColor ? textColor : null,
        highlight:
          typeof highlightColor === 'string' && highlightColor
            ? highlightColor
            : current.isActive('highlight')
              ? 'default'
              : null,
      };
    },
  });

  return (
    <div
      className={`tcm-rich-text-editor${maxHeight ? ' tcm-rich-text-editor--scrollable' : ''}`}
      style={maxHeight ? { maxHeight } : undefined}
    >
      <div className="tcm-rte-toolbar">
        <Group gap={4}>
          <Tooltip label="Жирный">
            <ActionIcon
              variant={toolbarState?.bold ? 'filled' : 'default'}
              disabled={!editor}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <IconBold size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Курсив">
            <ActionIcon
              variant={toolbarState?.italic ? 'filled' : 'default'}
              disabled={!editor}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <IconItalic size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Подчёркнутый">
            <ActionIcon
              variant={toolbarState?.underline ? 'filled' : 'default'}
              disabled={!editor}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            >
              <IconUnderline size={16} />
            </ActionIcon>
          </Tooltip>
          <RichTextColorControls
            editor={editor}
            color={toolbarState?.color ?? null}
            highlight={toolbarState?.highlight ?? null}
          />
          <Tooltip label="Маркированный список">
            <ActionIcon
              variant={toolbarState?.bulletList ? 'filled' : 'default'}
              disabled={!editor}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
            >
              <IconList size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Нумерованный список">
            <ActionIcon
              variant={toolbarState?.orderedList ? 'filled' : 'default'}
              disabled={!editor}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            >
              <IconListNumbers size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Увеличить вложенность (Tab), до 5 уровней">
            <ActionIcon
              variant="default"
              disabled={!editor || !toolbarState?.canSink}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor?.chain().focus().sinkListItem('listItem').run()}
            >
              <IconIndentIncrease size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Уменьшить вложенность (Shift+Tab)">
            <ActionIcon
              variant="default"
              disabled={!editor || !toolbarState?.canLift}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor?.chain().focus().liftListItem('listItem').run()}
            >
              <IconIndentDecrease size={16} />
            </ActionIcon>
          </Tooltip>
          {allowCodeAndLogs ? (
            <>
              <Tooltip label="Обрамить как код">
                <ActionIcon
                  variant={toolbarState?.code ? 'filled' : 'default'}
                  disabled={!editor}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor && toggleFenceBlock(editor, 'code')}
                >
                  <IconCode size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Обрамить как лог">
                <ActionIcon
                  variant={toolbarState?.log ? 'filled' : 'default'}
                  disabled={!editor}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => editor && toggleFenceBlock(editor, 'log')}
                >
                  <IconFileText size={16} />
                </ActionIcon>
              </Tooltip>
            </>
          ) : null}
          {allowImages ? (
            <FileButton
              accept="image/*"
              multiple
              onChange={(files) => {
                void insertImageFiles(editorRef.current, files ?? []);
              }}
            >
              {(props) => (
                <Tooltip label="Вставить скриншот (или Ctrl+V / Drag&Drop). Клик по картинке — увеличить">
                  <ActionIcon variant="default" disabled={!editor} {...props}>
                    <IconPhotoPlus size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </FileButton>
          ) : null}
        </Group>
      </div>
      <div className="tcm-rte-body">
        <EditorContent editor={editor} />
      </div>
      {error ? (
        <div style={{ color: 'var(--mantine-color-error)', fontSize: 12, marginTop: 4, padding: '0 8px 8px' }}>
          {error}
        </div>
      ) : null}

      {allowImages ? (
        <PhotoSlider
          images={lightboxImages}
          visible={lightboxOpen}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </div>
  );
}
