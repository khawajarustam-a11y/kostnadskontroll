"use client";

import { useId, useState } from "react";

type FilePickerProps = {
  name: string;
  accept: string;
  required?: boolean;
  chooseLabel: string;
  noFileLabel: string;
};

export function FilePicker({
  name,
  accept,
  required = false,
  chooseLabel,
  noFileLabel,
}: FilePickerProps) {
  const id = useId();
  const [fileName, setFileName] = useState(noFileLabel);

  return (
    <div className="file-picker">
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        className="file-picker-input"
        onChange={(event) => {
          setFileName(event.currentTarget.files?.[0]?.name || noFileLabel);
        }}
      />
      <label className="file-picker-button" htmlFor={id}>
        {chooseLabel}
      </label>
      <span className="file-picker-name">{fileName}</span>
    </div>
  );
}
