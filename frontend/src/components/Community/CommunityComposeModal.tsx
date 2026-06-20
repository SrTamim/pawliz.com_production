import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../context/ToastContext";
import { communityAPI, petsAPI, getImageUrl } from "../../lib/api";
import type { CommunityPost, CommunityTag } from "../../types";

const MAX_IMAGES = 2;
const DRAFT_KEY = "community_compose_draft";

interface Props {
  open: boolean;
  onClose: () => void;
  tags: CommunityTag[];
  editPost?: CommunityPost | null;
  onCreated?: (post: CommunityPost) => void;
  onUpdated?: (post: CommunityPost) => void;
}

interface ExistingImage {
  path: string;
}
interface NewImage {
  file: File;
  preview: string;
}

export default function CommunityComposeModal({ open, onClose, tags, editPost, onCreated, onUpdated }: Props) {
  const { t } = useTranslation("community");
  const { toast } = useToast();
  const isEdit = !!editPost;

  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [petId, setPetId] = useState<string>("");
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [newImages, setNewImages] = useState<NewImage[]>([]);
  const [pets, setPets] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load pets once when opened
  useEffect(() => {
    if (!open) return;
    petsAPI.getAll().then((d: any) => setPets(d.pets || d || [])).catch(() => {});
  }, [open]);

  // Hydrate fields from editPost or a saved draft
  useEffect(() => {
    if (!open) return;
    if (editPost) {
      setBody(editPost.body || "");
      setSelectedTags((editPost.tags || []).map((tg) => tg.slug));
      setPetId(editPost.pet_id ? String(editPost.pet_id) : "");
      setExistingImages((editPost.images || []).map((p) => ({ path: p })));
      setNewImages([]);
    } else {
      const draft = typeof window !== "undefined" ? localStorage.getItem(DRAFT_KEY) : null;
      if (draft) {
        try {
          const d = JSON.parse(draft);
          setBody(d.body || "");
          // Only restore tags that still exist + are active (stale drafts may
          // carry slugs deactivated by a tag reseed → server rejects them).
          const validSlugs = new Set(tags.map((tg) => tg.slug));
          setSelectedTags(Array.isArray(d.tags) ? d.tags.filter((s: string) => validSlugs.has(s)) : []);
        } catch { /* ignore */ }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editPost?.id]);

  // Persist a draft for new posts (so an accidental close doesn't lose a long post)
  useEffect(() => {
    if (!open || isEdit) return;
    const id = setTimeout(() => {
      try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ body, tags: selectedTags })); } catch { /* ignore */ }
    }, 400);
    return () => clearTimeout(id);
  }, [body, selectedTags, open, isEdit]);

  useEffect(() => () => newImages.forEach((img) => URL.revokeObjectURL(img.preview)), [newImages]);

  if (!open) return null;

  const totalImages = existingImages.length + newImages.length;

  const toggleTag = (slug: string) =>
    setSelectedTags((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : [...cur, slug]));

  const onPickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const room = MAX_IMAGES - totalImages;
    if (room <= 0) { toast(t("compose.maxImages"), "error"); return; }
    const take = files.slice(0, room);
    setNewImages((cur) => [...cur, ...take.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeExisting = (path: string) => setExistingImages((cur) => cur.filter((i) => i.path !== path));
  const removeNew = (preview: string) =>
    setNewImages((cur) => {
      const img = cur.find((i) => i.preview === preview);
      if (img) URL.revokeObjectURL(img.preview);
      return cur.filter((i) => i.preview !== preview);
    });

  const reset = () => {
    setBody(""); setSelectedTags([]); setPetId(""); setExistingImages([]); setNewImages([]);
  };

  const canSubmit = body.trim().length > 0 && selectedTags.length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!body.trim()) { toast(t("compose.bodyRequired"), "error"); return; }
    if (selectedTags.length === 0) { toast(t("compose.tagsRequired"), "error"); return; }
    setSubmitting(true);
    try {
      if (isEdit && editPost) {
        const data: any = {
          body: body.trim(),
          tags: selectedTags,
          images: newImages.map((i) => i.file),
          replace_images: "true",
        };
        if (petId) data.pet_id = petId;
        // When keeping existing images and not adding new, we still send replace
        // semantics — but the server only has new uploads. To preserve existing
        // images we re-send them is not possible (they're R2 paths); so when no
        // images changed, skip replace to keep them.
        if (newImages.length === 0 && existingImages.length === editPost.images.length) {
          delete data.replace_images;
        }
        const res = await communityAPI.updatePost(editPost.id, data);
        toast(t("compose.save"), "success");
        onUpdated?.(res.post);
      } else {
        const data: any = { body: body.trim(), tags: selectedTags, images: newImages.map((i) => i.file) };
        if (petId) data.pet_id = petId;
        const res = await communityAPI.createPost(data);
        toast(t("compose.submit"), "success");
        try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
        onCreated?.(res.post);
      }
      reset();
      onClose();
    } catch (err: any) {
      toast(err.message || "Failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto pb-[96px]"
      style={{ paddingTop: "calc(var(--header-height) + 16px)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[var(--bg-card)] border border-[var(--border)] rounded-lg w-full max-w-xl shadow-xl mx-3 md:mx-0 my-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border)] p-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold font-syne text-[var(--text-primary)]">
            {isEdit ? t("compose.editTitle") : t("compose.createTitle")}
          </h2>
          <button onClick={onClose} aria-label={t("compose.cancel")} className="text-2xl text-[var(--text-secondary)] hover:text-[var(--text-primary)]">✕</button>
        </div>

        <div className="p-5 space-y-4">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("compose.bodyPlaceholder")}
            maxLength={5000}
            rows={5}
            autoFocus
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-3 text-[var(--text-primary)] placeholder-[var(--text-secondary)] resize-none"
          />
          <div className="text-right text-xs text-[var(--text-secondary)] -mt-2">{body.length}/5000</div>

          {/* Tags */}
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">{t("compose.tagsLabel")}</p>
            <div className="flex flex-wrap gap-2">
              {tags.map((tg) => {
                const active = selectedTags.includes(tg.slug);
                return (
                  <button
                    key={tg.id}
                    type="button"
                    onClick={() => toggleTag(tg.slug)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                      active
                        ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                        : "border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]"
                    }`}
                  >
                    {tg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pet */}
          <div>
            <label className="text-sm font-semibold text-[var(--text-primary)] mb-2 block">{t("compose.petLabel")}</label>
            <select
              value={petId}
              onChange={(e) => setPetId(e.target.value)}
              className="w-full bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-2.5 text-[var(--text-primary)]"
            >
              <option value="">{t("compose.noPet")}</option>
              {pets.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Images */}
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">{t("compose.images")}</p>
            <div className="flex flex-wrap gap-2">
              {existingImages.map((img) => (
                <div key={img.path} className="relative w-20 h-20 rounded-lg overflow-hidden">
                  <img src={getImageUrl(img.path) ?? undefined} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeExisting(img.path)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 text-xs">✕</button>
                </div>
              ))}
              {newImages.map((img) => (
                <div key={img.preview} className="relative w-20 h-20 rounded-lg overflow-hidden">
                  <img src={img.preview} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeNew(img.preview)} className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full w-5 h-5 text-xs">✕</button>
                </div>
              ))}
              {totalImages < MAX_IMAGES && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-lg border-2 border-dashed border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] flex flex-col items-center justify-center text-xs"
                >
                  <span className="text-xl">＋</span>
                  {t("compose.addImage")}
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickImages} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("compose.cancel")}</button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-5 py-2 rounded-lg bg-[var(--accent)] text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (isEdit ? t("compose.saving") : t("compose.submitting")) : isEdit ? t("compose.save") : t("compose.submit")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
