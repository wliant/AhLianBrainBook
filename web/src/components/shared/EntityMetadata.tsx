interface EntityMetadataProps {
  createdBy: string;
  createdAt: string;
  lastUpdatedBy: string;
  updatedAt: string;
}

export function EntityMetadata({ createdBy, createdAt, lastUpdatedBy, updatedAt }: EntityMetadataProps) {
  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <p className="text-xs text-muted-foreground">
      Created by <span className="font-medium">{createdBy}</span> on {formatDate(createdAt)}
      {" \u00B7 "}
      Last updated by <span className="font-medium">{lastUpdatedBy}</span> on {formatDate(updatedAt)}
    </p>
  );
}
