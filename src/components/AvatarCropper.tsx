import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Crop,
  LoaderCircle,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import type { Language } from "../lib/finance";
import {
  AVATAR_VIEWPORT,
  getAvatarGeometry,
  loadAvatarSource,
  renderAvatarCrop,
} from "../lib/avatar";
import type {
  AvatarOffset,
  AvatarResolution,
  AvatarSource,
} from "../lib/avatar";
import "./AvatarCropper.css";

const copy = {
  ru: {
    eyebrow: "ФОТО КАПИТАНА",
    title: "Настроить аватар",
    subtitle: "Выберите, какая часть фото останется в кадре.",
    close: "Закрыть редактор аватара",
    loading: "Загружаем фото…",
    region: "Область кадрирования аватара",
    image: "Фото для кадрирования",
    hint: "Перетащите фото или используйте стрелки на клавиатуре.",
    zoom: "Масштаб",
    zoomIn: "Увеличить фото",
    zoomOut: "Уменьшить фото",
    reset: "Сбросить",
    up: "Сдвинуть фото вверх",
    down: "Сдвинуть фото вниз",
    left: "Сдвинуть фото влево",
    right: "Сдвинуть фото вправо",
    move: "Перемещение фото",
    resolution: "Размер фото",
    preview: "Предпросмотр аватара",
    original: "Исходный файл останется без изменений.",
    cancel: "Отмена",
    save: "Сохранить аватар",
    saving: "Сохраняем…",
    format: "Выберите фото в формате PNG, JPG или WebP.",
    size: "Не удалось подготовить фото. Выберите файл до 8 МБ или меньший размер фото.",
    error:
      "Не удалось открыть фото. Попробуйте другой PNG, JPG или WebP до 8 МБ.",
    saveError:
      "Не удалось сохранить фото. Попробуйте ещё раз или выберите другое изображение.",
  },
  en: {
    eyebrow: "CAPTAIN’S PHOTO",
    title: "Adjust avatar",
    subtitle: "Choose which part of your photo to keep.",
    close: "Close avatar editor",
    loading: "Loading photo…",
    region: "Avatar crop area",
    image: "Photo to crop",
    hint: "Drag your photo or use the arrow keys on your keyboard.",
    zoom: "Zoom",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    reset: "Reset",
    up: "Move photo up",
    down: "Move photo down",
    left: "Move photo left",
    right: "Move photo right",
    move: "Move photo",
    resolution: "Photo size",
    preview: "Avatar preview",
    original: "Your original file stays unchanged.",
    cancel: "Cancel",
    save: "Save avatar",
    saving: "Saving…",
    format: "Choose a PNG, JPG or WebP photo.",
    size: "Unable to prepare the photo. Choose a file under 8 MB or a smaller photo size.",
    error: "Unable to open the photo. Try another PNG, JPG or WebP under 8 MB.",
    saveError: "Unable to save the photo. Try again or choose another image.",
  },
} as const;

export default function AvatarCropper({
  file,
  src,
  language,
  onSave,
  onClose,
}: {
  file?: File;
  src?: string;
  language: Language;
  onSave: (dataURL: string) => void;
  onClose: () => void;
}) {
  const text = copy[language];
  const id = useId();
  const [source, setSource] = useState<AvatarSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<
    "format" | "size" | "error" | "saveError" | ""
  >("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<AvatarOffset>({ x: 0, y: 0 });
  const [resolution, setResolution] = useState<AvatarResolution>(512);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    pointer: number;
    x: number;
    y: number;
    offset: AvatarOffset;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loaded: AvatarSource | undefined;
    setLoading(true);
    setSource(null);
    setError("");
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    const input = file ?? src;
    if (!input) {
      setError("error");
      setLoading(false);
      return;
    }
    void loadAvatarSource(input).then(
      (result) => {
        if (cancelled) {
          result.dispose();
          return;
        }
        loaded = result;
        setSource(result);
        setLoading(false);
      },
      (reason: unknown) => {
        if (cancelled) return;
        const code = reason instanceof Error ? reason.message : "";
        setError(code === "format" || code === "size" ? code : "error");
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
      loaded?.dispose();
    };
  }, [file, src]);

  const geometry = source
    ? getAvatarGeometry(
        source.image.naturalWidth,
        source.image.naturalHeight,
        zoom,
        offset,
      )
    : null;
  const imageStyle: CSSProperties | undefined = geometry
    ? {
        width: `${(geometry.renderedWidth / AVATAR_VIEWPORT) * 100}%`,
        height: `${(geometry.renderedHeight / AVATAR_VIEWPORT) * 100}%`,
        left: `${50 + (geometry.offset.x / AVATAR_VIEWPORT) * 100}%`,
        top: `${50 + (geometry.offset.y / AVATAR_VIEWPORT) * 100}%`,
      }
    : undefined;

  function clampOffset(next: AvatarOffset, nextZoom = zoom) {
    if (!source) return { x: 0, y: 0 };
    return getAvatarGeometry(
      source.image.naturalWidth,
      source.image.naturalHeight,
      nextZoom,
      next,
    ).offset;
  }

  function changeZoom(value: number) {
    const next = Math.round(Math.min(4, Math.max(1, value)) * 100) / 100;
    setOffset((previous) =>
      clampOffset(
        { x: previous.x * (next / zoom), y: previous.y * (next / zoom) },
        next,
      ),
    );
    setZoom(next);
  }

  function move(x: number, y: number) {
    setOffset((previous) =>
      clampOffset({ x: previous.x + x, y: previous.y + y }),
    );
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (
      !source ||
      saving ||
      (event.pointerType === "mouse" && event.button !== 0)
    )
      return;
    if (drag.current) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointer: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offset: geometry!.offset,
    };
    setDragging(true);
  }

  function dragPhoto(event: PointerEvent<HTMLDivElement>) {
    const initial = drag.current;
    if (!initial || initial.pointer !== event.pointerId) return;
    const ratio =
      AVATAR_VIEWPORT / event.currentTarget.getBoundingClientRect().width;
    setOffset(
      clampOffset({
        x: initial.offset.x + (event.clientX - initial.x) * ratio,
        y: initial.offset.y + (event.clientY - initial.y) * ratio,
      }),
    );
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointer !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (!source || saving) return;
    const step = event.shiftKey ? 20 : 5;
    const directions: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const direction = directions[event.key];
    if (direction) {
      event.preventDefault();
      move(...direction);
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      changeZoom(zoom + 0.1);
    } else if (event.key === "-") {
      event.preventDefault();
      changeZoom(zoom - 0.1);
    } else if (event.key === "Home") {
      event.preventDefault();
      reset();
    }
  }

  function reset() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function save() {
    if (!source || saving) return;
    setSaving(true);
    setError("");
    try {
      onSave(renderAvatarCrop(source.image, zoom, offset, resolution));
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === "size"
          ? "size"
          : "saveError",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="avatar-crop-editor">
      <div className="avatar-crop-header">
        <div>
          <span className="avatar-crop-eyebrow">
            <Crop size={13} />
            {text.eyebrow}
          </span>
          <h2>{text.title}</h2>
          <p>{text.subtitle}</p>
        </div>
        <button
          type="button"
          className="avatar-crop-icon avatar-crop-close"
          onClick={onClose}
          aria-label={text.close}
        >
          <X size={19} />
        </button>
      </div>
      {loading && (
        <div className="avatar-crop-loading" role="status">
          <LoaderCircle size={25} />
          <p>{text.loading}</p>
        </div>
      )}
      {source && (
        <>
          <div
            className={`avatar-crop-viewport${dragging ? " avatar-crop-dragging" : ""}`}
            role="group"
            tabIndex={0}
            aria-label={text.region}
            aria-describedby={`${id}-hint`}
            onPointerDown={startDrag}
            onPointerMove={dragPhoto}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onLostPointerCapture={endDrag}
            onKeyDown={handleKeys}
          >
            <img
              src={source.url}
              alt={text.image}
              style={imageStyle}
              draggable={false}
            />
            <div className="avatar-crop-guide" aria-hidden="true" />
          </div>
          <p className="avatar-crop-hint" id={`${id}-hint`}>
            {text.hint}
          </p>
          <div className="avatar-crop-zoom-label">
            <label htmlFor={`${id}-zoom`}>{text.zoom}</label>
            <output htmlFor={`${id}-zoom`}>{Math.round(zoom * 100)}%</output>
          </div>
          <div className="avatar-crop-zoom">
            <button
              type="button"
              className="avatar-crop-icon"
              aria-label={text.zoomOut}
              onClick={() => changeZoom(zoom - 0.1)}
              disabled={zoom <= 1 || saving}
            >
              <Minus size={17} />
            </button>
            <input
              id={`${id}-zoom`}
              type="range"
              min="1"
              max="4"
              step="0.01"
              value={zoom}
              onChange={(event) => changeZoom(Number(event.target.value))}
              disabled={saving}
              aria-valuetext={`${Math.round(zoom * 100)}%`}
            />
            <button
              type="button"
              className="avatar-crop-icon"
              aria-label={text.zoomIn}
              onClick={() => changeZoom(zoom + 0.1)}
              disabled={zoom >= 4 || saving}
            >
              <Plus size={17} />
            </button>
          </div>
          <div className="avatar-crop-position">
            <div
              className="avatar-crop-arrows"
              role="group"
              aria-label={text.move}
            >
              <button
                type="button"
                className="avatar-crop-icon"
                aria-label={text.left}
                onClick={() => move(-10, 0)}
                disabled={saving}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                className="avatar-crop-icon"
                aria-label={text.up}
                onClick={() => move(0, -10)}
                disabled={saving}
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                className="avatar-crop-icon"
                aria-label={text.down}
                onClick={() => move(0, 10)}
                disabled={saving}
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                className="avatar-crop-icon"
                aria-label={text.right}
                onClick={() => move(10, 0)}
                disabled={saving}
              >
                <ArrowRight size={16} />
              </button>
            </div>
            <button
              type="button"
              className="avatar-crop-reset"
              onClick={reset}
              disabled={saving}
            >
              <RotateCcw size={14} />
              {text.reset}
            </button>
          </div>
          <div className="avatar-crop-output">
            <div className="avatar-crop-resolution">
              <label htmlFor={`${id}-resolution`}>{text.resolution}</label>
              <select
                id={`${id}-resolution`}
                value={resolution}
                onChange={(event) =>
                  setResolution(Number(event.target.value) as AvatarResolution)
                }
                disabled={saving}
              >
                <option value="256">256 × 256 px</option>
                <option value="512">512 × 512 px</option>
              </select>
            </div>
            <div
              className="avatar-crop-preview"
              role="img"
              aria-label={text.preview}
            >
              <img
                src={source.url}
                alt=""
                style={imageStyle}
                draggable={false}
              />
            </div>
          </div>
          <p className="avatar-crop-original">{text.original}</p>
        </>
      )}
      {error && (
        <p className="avatar-crop-error" role="alert">
          {text[error]}
        </p>
      )}
      <div className="avatar-crop-footer">
        <button
          type="button"
          className="avatar-crop-button avatar-crop-cancel"
          onClick={onClose}
        >
          {text.cancel}
        </button>
        <button
          type="button"
          className="avatar-crop-button avatar-crop-save"
          onClick={save}
          disabled={!source || loading || saving}
        >
          <Check size={17} />
          {saving ? text.saving : text.save}
        </button>
      </div>
    </div>
  );
}
