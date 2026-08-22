import type { ChangeSetReviewResult } from '@idle/contracts';

interface Props { review: ChangeSetReviewResult | null; applying: boolean; onApply: () => void; }

export function ChangeSetReview({ review, applying, onApply }: Props) {
  if (!review) return null;
  return (
    <section className="changeset-review" aria-label="Change review">
      <div className="changeset-review-header">
        <div><strong>Review changes</strong><span>{review.preview?.files.length ?? 0} file(s)</span></div>
        <span className={review.valid ? 'review-valid' : 'review-invalid'}>{review.valid ? 'Ready to apply' : 'Needs attention'}</span>
      </div>
      {!review.valid ? (
        <div className="changeset-errors">{review.errors.map((error) => <p key={`${error.path}-${error.code}`}><strong>{error.path || 'ChangeSet'}:</strong> {error.message}</p>)}</div>
      ) : (
        <>
          <div className="changeset-files">{review.preview?.files.map((file) => <div className="changeset-file" key={file.path}><span>{file.operation}</span><strong>{file.path}</strong><small>+{file.additions} / -{file.deletions}</small></div>)}</div>
          <button className="primary-action review-apply" type="button" onClick={onApply} disabled={applying}>{applying ? 'Applying…' : 'Apply changes'}</button>
        </>
      )}
    </section>
  );
}
