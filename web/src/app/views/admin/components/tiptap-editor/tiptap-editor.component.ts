import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

@Component({
  selector: 'app-tiptap-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tiptap-editor.component.html',
  styleUrl: './tiptap-editor.component.scss',
})
export class TipTapEditorComponent implements AfterViewInit, OnDestroy {
  @ViewChild('editorContainer', { static: true })
  editorContainer!: ElementRef<HTMLDivElement>;

  readonly content = input<string>('');
  readonly placeholder = input<string>('Napisz treść artykułu...');
  readonly contentChange = output<string>();

  editor: Editor | null = null;
  readonly isReady = signal(false);

  // Active state signals for toolbar buttons
  readonly isBoldActive = signal(false);
  readonly isItalicActive = signal(false);
  readonly isH2Active = signal(false);
  readonly isH3Active = signal(false);
  readonly isBulletListActive = signal(false);
  readonly isOrderedListActive = signal(false);
  readonly isBlockquoteActive = signal(false);
  readonly isLinkActive = signal(false);

  constructor() {
    // Effect to update editor content when parent inputs new content (e.g. on load)
    effect(() => {
      const incoming = this.content();
      if (this.editor && incoming !== this.editor.getHTML()) {
        this.editor.commands.setContent(incoming || '', { emitUpdate: false });
        this.updateActiveStates();
      }
    });
  }

  ngAfterViewInit(): void {
    this.initEditor();
  }

  ngOnDestroy(): void {
    if (this.editor) {
      this.editor.destroy();
      this.editor = null;
    }
  }

  private initEditor(): void {
    this.editor = new Editor({
      element: this.editorContainer.nativeElement,
      extensions: [
        StarterKit.configure({
          heading: {
            levels: [2, 3],
          },
        }),
        Placeholder.configure({
          placeholder: this.placeholder(),
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'editor-link',
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        }),
      ],
      content: this.content() || '',
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        this.contentChange.emit(html);
        this.updateActiveStates();
      },
      onSelectionUpdate: () => {
        this.updateActiveStates();
      },
      onTransaction: () => {
        this.updateActiveStates();
      },
    });

    this.isReady.set(true);
    this.updateActiveStates();
  }

  private updateActiveStates(): void {
    if (!this.editor) return;
    this.isBoldActive.set(this.editor.isActive('bold'));
    this.isItalicActive.set(this.editor.isActive('italic'));
    this.isH2Active.set(this.editor.isActive('heading', { level: 2 }));
    this.isH3Active.set(this.editor.isActive('heading', { level: 3 }));
    this.isBulletListActive.set(this.editor.isActive('bulletList'));
    this.isOrderedListActive.set(this.editor.isActive('orderedList'));
    this.isBlockquoteActive.set(this.editor.isActive('blockquote'));
    this.isLinkActive.set(this.editor.isActive('link'));
  }

  // Toolbar Actions
  toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  toggleItalic(): void {
    this.editor?.chain().focus().toggleItalic().run();
  }

  toggleH2(): void {
    this.editor?.chain().focus().toggleHeading({ level: 2 }).run();
  }

  toggleH3(): void {
    this.editor?.chain().focus().toggleHeading({ level: 3 }).run();
  }

  toggleBulletList(): void {
    this.editor?.chain().focus().toggleBulletList().run();
  }

  toggleOrderedList(): void {
    this.editor?.chain().focus().toggleOrderedList().run();
  }

  toggleBlockquote(): void {
    this.editor?.chain().focus().toggleBlockquote().run();
  }

  setHorizontalRule(): void {
    this.editor?.chain().focus().setHorizontalRule().run();
  }

  setLink(): void {
    if (!this.editor) return;
    const previousUrl = this.editor.getAttributes('link')['href'] || '';
    const url = window.prompt('Wklej adres URL odnośnika:', previousUrl);

    if (url === null) {
      return; // cancelled
    }

    if (url.trim() === '') {
      this.editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    this.editor
      .chain()
      .focus()
      .extendMarkRange('link')
      .setLink({ href: url.trim() })
      .run();
  }

  undo(): void {
    this.editor?.chain().focus().undo().run();
  }

  redo(): void {
    this.editor?.chain().focus().redo().run();
  }
}
