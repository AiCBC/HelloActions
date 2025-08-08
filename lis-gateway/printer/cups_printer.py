import os
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional


class PrinterService:
    def __init__(self, printer_name: Optional[str] = None, output_dir: Optional[str] = None) -> None:
        self.printer_name = printer_name
        self._output_dir = Path(output_dir or ".")
        self._output_dir.mkdir(parents=True, exist_ok=True)
        self._cups = None
        try:
            import cups  # type: ignore

            self._cups = cups.Connection()
        except Exception:
            self._cups = None

    @property
    def is_available(self) -> bool:
        return self._cups is not None

    def print_text(self, text: str, title: str = "LIS Print") -> None:
        if self._cups is not None:
            with tempfile.NamedTemporaryFile("w", delete=False, encoding="utf-8", suffix=".txt") as tmp:
                tmp.write(text)
                tmp_path = tmp.name
            try:
                printer = self.printer_name or self._get_default_printer()
                if not printer:
                    raise RuntimeError("No CUPS printer available")
                self._cups.printFile(printer, tmp_path, title, {})
            finally:
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
        else:
            ts = datetime.now().strftime("%Y%m%d-%H%M%S")
            out_path = self._output_dir / f"print-{ts}.txt"
            out_path.write_text(text, encoding="utf-8")

    def _get_default_printer(self) -> Optional[str]:
        if self._cups is None:
            return None
        try:
            default = self._cups.getDefault()
            if default:
                return default
            printers = self._cups.getPrinters()
            if printers:
                return list(printers.keys())[0]
        except Exception:
            return None
        return None