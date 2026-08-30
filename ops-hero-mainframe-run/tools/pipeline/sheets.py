"""Spritesheet packing, PNG writing and visual contact sheets."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, PngImagePlugin

from .chroma import harden_alpha

PLACEHOLDER_CHUNK_KEY = "phTrack"
"""iTXt marker written into placeholder PNGs only, so validation can report which track
(placeholder vs production) produced the current public/assets tree."""


def pack_horizontal(frames: list[Image.Image], frame_w: int, frame_h: int) -> Image.Image:
    """Uniform horizontal spritesheet -- the layout Phaser's spritesheet loader expects."""
    for index, frame in enumerate(frames):
        if frame.size != (frame_w, frame_h):
            raise ValueError(f"frame {index} is {frame.size}, expected ({frame_w}, {frame_h})")
    sheet = Image.new("RGBA", (frame_w * len(frames), frame_h), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.paste(frame, (index * frame_w, 0))
    return sheet


def write_png(image: Image.Image, path: Path, *, placeholder: bool = False) -> None:
    """Deterministic PNG write: hard alpha, no timestamp chunk, fixed compression."""
    path.parent.mkdir(parents=True, exist_ok=True)
    output = harden_alpha(image)
    kwargs: dict[str, object] = {"optimize": False, "compress_level": 6}
    if placeholder:
        info = PngImagePlugin.PngInfo()
        info.add_itxt(PLACEHOLDER_CHUNK_KEY, "placeholder")
        kwargs["pnginfo"] = info
    output.save(path, format="PNG", **kwargs)


def is_placeholder(path: Path) -> bool:
    with Image.open(path) as image:
        return image.info.get(PLACEHOLDER_CHUNK_KEY) == "placeholder"


def _checkerboard(width: int, height: int, cell: int = 4) -> Image.Image:
    board = Image.new("RGBA", (width, height), (48, 48, 56, 255))
    draw = ImageDraw.Draw(board)
    for y in range(0, height, cell):
        for x in range(0, width, cell):
            if ((x // cell) + (y // cell)) % 2 == 0:
                draw.rectangle([x, y, x + cell - 1, y + cell - 1], fill=(64, 64, 74, 255))
    return board


def contact_sheet(
    frames: list[Image.Image], title: str, zoom: int = 4, columns: int = 8
) -> Image.Image:
    """Zoomed frames on a checkerboard with indices -- the artefact a human reviews in Phase 3."""
    if not frames:
        return Image.new("RGBA", (160, 40), (24, 24, 30, 255))
    fw, fh = frames[0].size
    cell_w, cell_h = fw * zoom, fh * zoom
    pad, header, label_h = 6, 16, 10
    cols = min(columns, len(frames))
    rows = (len(frames) + cols - 1) // cols
    width = cols * (cell_w + pad) + pad
    height = header + rows * (cell_h + label_h + pad) + pad

    canvas = Image.new("RGBA", (width, height), (24, 24, 30, 255))
    draw = ImageDraw.Draw(canvas)
    draw.text((pad, 4), f"{title}  {len(frames)} frames  {fw}x{fh}", fill=(150, 230, 190, 255))

    for index, frame in enumerate(frames):
        col, row = index % cols, index // cols
        x = pad + col * (cell_w + pad)
        y = header + row * (cell_h + label_h + pad)
        canvas.paste(_checkerboard(cell_w, cell_h), (x, y))
        zoomed = frame.resize((cell_w, cell_h), Image.Resampling.NEAREST)
        canvas.paste(zoomed, (x, y), zoomed)
        draw.rectangle([x, y, x + cell_w - 1, y + cell_h - 1], outline=(90, 90, 110, 255))
        draw.text((x + 2, y + cell_h + 1), str(index), fill=(200, 200, 210, 255))
    return canvas


def diagnostic_overlay(board: Image.Image, regions: list[object]) -> Image.Image:
    """Source board with numbered bounding boxes. Overrides drawn in a different colour."""
    canvas = board.convert("RGBA").copy()
    draw = ImageDraw.Draw(canvas)
    for region in regions:
        x = getattr(region, "x")
        y = getattr(region, "y")
        w = getattr(region, "w")
        h = getattr(region, "h")
        rid = getattr(region, "id")
        is_override = getattr(region, "source", "auto") == "override"
        colour = (255, 90, 200, 255) if is_override else (90, 220, 255, 255)
        draw.rectangle([x, y, x + w - 1, y + h - 1], outline=colour, width=2)
        draw.text((x + 2, max(0, y - 11)), rid, fill=colour)
    return canvas
