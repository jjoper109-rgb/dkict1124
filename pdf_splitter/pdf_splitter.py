import re
import threading
from pathlib import Path
from tkinter import (
    BOTH,
    DISABLED,
    END,
    LEFT,
    NORMAL,
    Button,
    Checkbutton,
    Canvas,
    Entry,
    Frame,
    IntVar,
    Label,
    LabelFrame,
    Radiobutton,
    StringVar,
    Tk,
    PhotoImage,
    filedialog,
    messagebox,
)

import fitz
from pypdf import PdfReader, PdfWriter


APP_DIR = Path(__file__).resolve().parent
DESIGN_DK = {
    "primary": "#0077C0",
    "primary_dark": "#005B96",
    "primary_light": "#EAF5FC",
    "text": "#17324D",
    "border": "#C9DCEB",
    "surface": "#F6FAFD",
    "white": "#FFFFFF",
}

DK_BLUE = DESIGN_DK["primary"]
DK_BLUE_DARK = DESIGN_DK["primary_dark"]
DK_BLUE_LIGHT = DESIGN_DK["primary_light"]
TEXT_DARK = DESIGN_DK["text"]
BORDER = DESIGN_DK["border"]
SURFACE = DESIGN_DK["surface"]
WHITE = DESIGN_DK["white"]


class PdfSplitterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("PDF 분할 도구")
        self.root.geometry("980x560")
        self.root.minsize(900, 520)
        self.root.configure(bg=SURFACE)

        icon_path = APP_DIR / "DK_logo.ico"
        if icon_path.exists():
            self.root.iconbitmap(str(icon_path))

        self.pdf_path = StringVar()
        self.output_dir = StringVar()
        self.mode = StringVar(value="each")
        self.range_text = StringVar()
        self.prefix = StringVar(value="split")
        self.open_folder = IntVar(value=1)
        self.status = StringVar(value="PDF 파일을 선택하세요.")
        self.preview_status = StringVar(value="")
        self.current_page = 1
        self.page_count = 0
        self.preview_image = None
        self.logo_image = None

        self._build_ui()

    def _build_ui(self):
        header = Frame(self.root, bg=DK_BLUE, padx=20, pady=16)
        header.pack(fill="x")

        logo_path = APP_DIR / "DK_logo.png"
        if logo_path.exists():
            self.logo_image = PhotoImage(file=str(logo_path))
            Label(header, image=self.logo_image, bg=DK_BLUE).pack(side=LEFT, padx=(0, 12))

        title_box = Frame(header, bg=DK_BLUE)
        title_box.pack(side=LEFT, fill="x", expand=True)
        Label(
            title_box,
            text="PDF 분할 도구",
            bg=DK_BLUE,
            fg=WHITE,
            font=("Malgun Gothic", 18, "bold"),
        ).pack(anchor="w")
        Label(
            title_box,
            text="PDF를 페이지별 또는 지정 범위별로 빠르게 저장합니다.",
            bg=DK_BLUE,
            fg="#D7EFFB",
            font=("Malgun Gothic", 10),
        ).pack(anchor="w", pady=(3, 0))

        outer = Frame(self.root, padx=20, pady=18, bg=SURFACE)
        outer.pack(fill=BOTH, expand=True)

        content = Frame(outer, bg=SURFACE)
        content.pack(fill=BOTH, expand=True)

        left_panel = Frame(content, bg=SURFACE)
        left_panel.pack(side="left", fill=BOTH, expand=True, padx=(0, 16))

        preview_panel = LabelFrame(
            content,
            text="PDF 미리보기",
            padx=12,
            pady=12,
            bg=WHITE,
            fg=TEXT_DARK,
            font=("Malgun Gothic", 10, "bold"),
            bd=1,
            relief="solid",
        )
        preview_panel.pack(side="left", fill="y")

        self.section_label(left_panel, "PDF 파일")
        file_row = Frame(left_panel)
        file_row.configure(bg=SURFACE)
        file_row.pack(fill="x", pady=(4, 12))
        self.text_entry(file_row, self.pdf_path).pack(side="left", fill="x", expand=True)
        self.small_button(file_row, "찾기", self.choose_pdf).pack(side="left", padx=(8, 0))

        self.section_label(left_panel, "저장 폴더")
        dir_row = Frame(left_panel)
        dir_row.configure(bg=SURFACE)
        dir_row.pack(fill="x", pady=(4, 12))
        self.text_entry(dir_row, self.output_dir).pack(side="left", fill="x", expand=True)
        self.small_button(dir_row, "찾기", self.choose_output_dir).pack(side="left", padx=(8, 0))

        options = LabelFrame(
            left_panel,
            text="분할 방식",
            padx=14,
            pady=12,
            bg=WHITE,
            fg=TEXT_DARK,
            font=("Malgun Gothic", 10, "bold"),
            bd=1,
            relief="solid",
        )
        options.pack(fill="x", pady=(0, 12))

        Radiobutton(
            options,
            text="모든 페이지를 1페이지씩 분할",
            variable=self.mode,
            value="each",
            command=self.update_range_state,
            bg=WHITE,
            fg=TEXT_DARK,
            selectcolor=DK_BLUE_LIGHT,
            activebackground=WHITE,
            activeforeground=DK_BLUE_DARK,
            font=("Malgun Gothic", 10),
        ).pack(anchor="w")

        range_row = Frame(options)
        range_row.configure(bg=WHITE)
        range_row.pack(fill="x", pady=(8, 0))
        Radiobutton(
            range_row,
            text="범위 지정",
            variable=self.mode,
            value="range",
            command=self.update_range_state,
            bg=WHITE,
            fg=TEXT_DARK,
            selectcolor=DK_BLUE_LIGHT,
            activebackground=WHITE,
            activeforeground=DK_BLUE_DARK,
            font=("Malgun Gothic", 10),
        ).pack(side="left")
        self.range_entry = self.text_entry(range_row, self.range_text, state=DISABLED)
        self.range_entry.pack(side="left", fill="x", expand=True, padx=(8, 0))
        Label(
            options,
            text="예: 1-3, 4, 5-7",
            bg=WHITE,
            fg="#557086",
            font=("Malgun Gothic", 9),
        ).pack(anchor="w", pady=(6, 0))

        prefix_row = Frame(left_panel)
        prefix_row.configure(bg=SURFACE)
        prefix_row.pack(fill="x", pady=(0, 12))
        Label(
            prefix_row,
            text="파일명 앞부분",
            bg=SURFACE,
            fg=TEXT_DARK,
            font=("Malgun Gothic", 10, "bold"),
        ).pack(side="left")
        self.text_entry(prefix_row, self.prefix, width=22).pack(side="left", padx=(8, 0))
        Checkbutton(
            prefix_row,
            text="완료 후 폴더 열기",
            variable=self.open_folder,
            bg=SURFACE,
            fg=TEXT_DARK,
            activebackground=SURFACE,
            selectcolor=DK_BLUE_LIGHT,
            font=("Malgun Gothic", 10),
        ).pack(side="left", padx=(18, 0))

        self.run_button = Button(
            left_panel,
            text="PDF 분할 시작",
            height=2,
            command=self.start_split,
            bg=DK_BLUE,
            fg=WHITE,
            activebackground=DK_BLUE_DARK,
            activeforeground=WHITE,
            relief="flat",
            bd=0,
            cursor="hand2",
            font=("Malgun Gothic", 12, "bold"),
        )
        self.run_button.pack(fill="x", pady=(4, 12))

        Label(
            left_panel,
            textvariable=self.status,
            anchor="w",
            bg=SURFACE,
            fg="#47657A",
            font=("Malgun Gothic", 10),
        ).pack(fill="x")

        self.preview_canvas = Canvas(
            preview_panel,
            bg="#EEF4F8",
            width=34,
            height=18,
            bd=1,
            relief="solid",
            highlightthickness=0,
        )
        self.preview_canvas.configure(width=300, height=380)
        self.preview_canvas.pack()
        self.preview_canvas.create_text(
            150,
            190,
            text="PDF를 선택하면\n첫 페이지가 표시됩니다.",
            fill="#557086",
            font=("Malgun Gothic", 10),
            justify="center",
            tags="placeholder",
        )
        self.preview_canvas.bind("<Button-1>", self.focus_preview)
        self.preview_canvas.bind("<MouseWheel>", self.preview_mouse_wheel)
        self.preview_canvas.bind("<Button-4>", self.preview_mouse_wheel)
        self.preview_canvas.bind("<Button-5>", self.preview_mouse_wheel)

        nav_row = Frame(preview_panel, bg=WHITE)
        nav_row.pack(fill="x", pady=(8, 0))
        self.prev_button = self.small_button(nav_row, "이전", self.preview_prev_page)
        self.prev_button.pack(side="left")
        self.next_button = self.small_button(nav_row, "다음", self.preview_next_page)
        self.next_button.pack(side="right")
        self.update_preview_buttons()

    def section_label(self, parent, text):
        Label(
            parent,
            text=text,
            bg=SURFACE,
            fg=TEXT_DARK,
            font=("Malgun Gothic", 10, "bold"),
        ).pack(anchor="w")

    def text_entry(self, parent, variable, width=None, state=NORMAL):
        return Entry(
            parent,
            textvariable=variable,
            width=width,
            state=state,
            bg=WHITE,
            fg=TEXT_DARK,
            disabledbackground="#EEF4F8",
            disabledforeground="#7F92A3",
            insertbackground=DK_BLUE,
            relief="solid",
            bd=1,
            highlightthickness=1,
            highlightbackground=BORDER,
            highlightcolor=DK_BLUE,
            font=("Malgun Gothic", 10),
        )

    def small_button(self, parent, text, command):
        return Button(
            parent,
            text=text,
            width=10,
            command=command,
            bg=DK_BLUE_DARK,
            fg=WHITE,
            activebackground=DK_BLUE,
            activeforeground=WHITE,
            relief="flat",
            bd=0,
            cursor="hand2",
            font=("Malgun Gothic", 10, "bold"),
        )

    def choose_pdf(self):
        selected = filedialog.askopenfilename(
            title="PDF 파일 선택",
            filetypes=[("PDF 파일", "*.pdf"), ("모든 파일", "*.*")],
        )
        if selected:
            self.pdf_path.set(selected)
            if not self.output_dir.get():
                self.output_dir.set(str(Path(selected).with_suffix("")))
            if self.prefix.get() == "split":
                self.prefix.set(Path(selected).stem)
            self.status.set("분할 방식을 선택한 뒤 시작하세요.")
            self.load_pdf_preview(Path(selected))

    def choose_output_dir(self):
        selected = filedialog.askdirectory(title="저장 폴더 선택")
        if selected:
            self.output_dir.set(selected)

    def update_range_state(self):
        state = NORMAL if self.mode.get() == "range" else DISABLED
        self.range_entry.configure(state=state)

    def load_pdf_preview(self, pdf_path):
        try:
            with fitz.open(str(pdf_path)) as document:
                self.page_count = document.page_count
            self.current_page = 1
            self.render_preview()
        except Exception as exc:
            self.page_count = 0
            self.current_page = 1
            self.preview_image = None
            self.draw_preview_message("미리보기를 표시할 수 없습니다.")
            self.preview_status.set("미리보기 오류")
            self.update_preview_buttons()
            self.status.set(f"PDF는 선택됐지만 미리보기 오류: {exc}")

    def render_preview(self):
        pdf_path = Path(self.pdf_path.get())
        if not pdf_path.is_file() or self.page_count < 1:
            return

        try:
            with fitz.open(str(pdf_path)) as document:
                page = document.load_page(self.current_page - 1)
                max_width = 300
                max_height = 380
                zoom = min(max_width / page.rect.width, max_height / page.rect.height)
                zoom = max(0.2, min(zoom, 2.0))
                pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)

            self.preview_image = PhotoImage(data=pixmap.tobytes("ppm"), format="PPM")
            self.preview_status.set(f"-{self.current_page}-")
            self.draw_preview_page()
            self.update_preview_buttons()
        except Exception as exc:
            self.preview_image = None
            self.draw_preview_message("미리보기를 표시할 수 없습니다.")
            self.preview_status.set("미리보기 오류")
            self.update_preview_buttons()
            self.status.set(f"미리보기 오류: {exc}")

    def preview_prev_page(self):
        if self.current_page > 1:
            self.current_page -= 1
            self.render_preview()

    def preview_next_page(self):
        if self.current_page < self.page_count:
            self.current_page += 1
            self.render_preview()

    def focus_preview(self, _event=None):
        self.preview_canvas.focus_set()

    def preview_mouse_wheel(self, event):
        if self.page_count < 1:
            return "break"

        if getattr(event, "num", None) == 4 or getattr(event, "delta", 0) > 0:
            self.preview_prev_page()
        elif getattr(event, "num", None) == 5 or getattr(event, "delta", 0) < 0:
            self.preview_next_page()

        return "break"

    def draw_preview_page(self):
        self.preview_canvas.delete("all")
        canvas_width = 300
        canvas_height = 380
        image_width = self.preview_image.width()
        image_height = self.preview_image.height()
        x = max(0, (canvas_width - image_width) // 2)
        y = max(0, (canvas_height - image_height) // 2)
        self.preview_canvas.create_rectangle(
            0,
            0,
            canvas_width,
            canvas_height,
            fill=WHITE,
            outline=BORDER,
        )
        self.preview_canvas.create_image(x, y, image=self.preview_image, anchor="nw")
        self.preview_canvas.create_rectangle(
            124,
            canvas_height - 28,
            176,
            canvas_height - 6,
            fill=WHITE,
            outline=BORDER,
        )
        self.preview_canvas.create_text(
            canvas_width // 2,
            canvas_height - 17,
            text=self.preview_status.get(),
            fill=TEXT_DARK,
            font=("Malgun Gothic", 10, "bold"),
        )

    def draw_preview_message(self, message):
        self.preview_canvas.delete("all")
        self.preview_canvas.configure(bg="#EEF4F8")
        self.preview_canvas.create_text(
            150,
            190,
            text=message,
            fill="#557086",
            font=("Malgun Gothic", 10),
            justify="center",
        )

    def update_preview_buttons(self):
        prev_state = NORMAL if self.page_count > 0 and self.current_page > 1 else DISABLED
        next_state = NORMAL if self.page_count > 0 and self.current_page < self.page_count else DISABLED
        self.prev_button.configure(state=prev_state)
        self.next_button.configure(state=next_state)

    def start_split(self):
        try:
            pdf_path = Path(self.pdf_path.get())
            output_dir = Path(self.output_dir.get())
            prefix = self.safe_name(self.prefix.get().strip() or pdf_path.stem)

            if not pdf_path.is_file():
                raise ValueError("PDF 파일을 선택하세요.")
            if pdf_path.suffix.lower() != ".pdf":
                raise ValueError("PDF 파일만 선택할 수 있습니다.")
            if not output_dir:
                raise ValueError("저장 폴더를 선택하세요.")

            self.run_button.configure(state=DISABLED)
            self.status.set("분할 작업 중입니다...")
            worker = threading.Thread(
                target=self.split_pdf,
                args=(pdf_path, output_dir, prefix),
                daemon=True,
            )
            worker.start()
        except Exception as exc:
            messagebox.showerror("확인 필요", str(exc))

    def split_pdf(self, pdf_path, output_dir, prefix):
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
            reader = PdfReader(str(pdf_path))
            page_count = len(reader.pages)

            if self.mode.get() == "each":
                jobs = [(index + 1, index + 1) for index in range(page_count)]
            else:
                jobs = parse_ranges(self.range_text.get(), page_count)

            written = []
            for start, end in jobs:
                writer = PdfWriter()
                for page_number in range(start, end + 1):
                    writer.add_page(reader.pages[page_number - 1])

                if start == end:
                    filename = f"{prefix}_p{start}.pdf"
                else:
                    filename = f"{prefix}_p{start}-{end}.pdf"

                output_path = output_dir / filename
                with output_path.open("wb") as file:
                    writer.write(file)
                written.append(output_path)

            self.root.after(0, self.finish_success, output_dir, len(written))
        except Exception as exc:
            self.root.after(0, self.finish_error, str(exc))

    def finish_success(self, output_dir, count):
        self.run_button.configure(state=NORMAL)
        self.status.set(f"완료: {count}개 파일을 저장했습니다.")
        messagebox.showinfo("완료", f"PDF 분할 완료\n저장 파일: {count}개")
        if self.open_folder.get():
            open_folder(output_dir)

    def finish_error(self, message):
        self.run_button.configure(state=NORMAL)
        self.status.set("오류가 발생했습니다.")
        messagebox.showerror("오류", message)

    @staticmethod
    def safe_name(value):
        cleaned = re.sub(r'[\\/:*?"<>|]+', "_", value)
        return cleaned.strip(" .") or "split"


def parse_ranges(text, page_count):
    if not text.strip():
        raise ValueError("분할 범위를 입력하세요. 예: 1-3, 4, 5-7")

    ranges = []
    for token in text.split(","):
        part = token.strip()
        if not part:
            continue

        if "-" in part:
            pieces = [item.strip() for item in part.split("-", 1)]
            if len(pieces) != 2 or not pieces[0].isdigit() or not pieces[1].isdigit():
                raise ValueError(f"범위 형식이 올바르지 않습니다: {part}")
            start, end = int(pieces[0]), int(pieces[1])
        else:
            if not part.isdigit():
                raise ValueError(f"페이지 번호가 올바르지 않습니다: {part}")
            start = end = int(part)

        if start < 1 or end < 1:
            raise ValueError("페이지 번호는 1 이상이어야 합니다.")
        if start > end:
            raise ValueError(f"시작 페이지가 끝 페이지보다 큽니다: {part}")
        if end > page_count:
            raise ValueError(f"PDF는 총 {page_count}페이지입니다. 범위를 확인하세요: {part}")

        ranges.append((start, end))

    if not ranges:
        raise ValueError("분할 범위를 입력하세요.")

    return ranges


def open_folder(path):
    import os

    os.startfile(str(path))


def main():
    root = Tk()
    app = PdfSplitterApp(root)
    root.mainloop()


if __name__ == "__main__":
    main()
