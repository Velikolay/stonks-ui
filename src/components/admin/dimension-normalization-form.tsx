"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type DimensionOverrideFormData = {
  axis: string;
  member: string;
  member_label: string;
  normalized_axis_label: string;
  normalized_member_label: string;
  tags: string;
};

interface DimensionNormalizationFormProps {
  mode: "create" | "edit";
  formData: DimensionOverrideFormData;
  setFormData: React.Dispatch<React.SetStateAction<DimensionOverrideFormData>>;
}

export const DimensionNormalizationForm = React.memo(
  function DimensionNormalizationForm({
    mode,
    formData,
    setFormData,
  }: DimensionNormalizationFormProps) {
    const idPrefix = mode;
    const isEdit = mode === "edit";

    return (
      <div className="space-y-4">
        {isEdit ? (
          <>
            <div>
              <Label>Axis</Label>
              <Input value={formData.axis} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Member</Label>
              <Input value={formData.member} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Member Label</Label>
              <Input
                value={formData.member_label}
                disabled
                className="bg-muted"
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor={`${idPrefix}-axis`}>Axis *</Label>
              <Input
                id={`${idPrefix}-axis`}
                value={formData.axis}
                onChange={e =>
                  setFormData(prev => ({ ...prev, axis: e.target.value }))
                }
                placeholder="e.g., us-gaap:EntityAxis"
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-member`}>Member</Label>
              <Input
                id={`${idPrefix}-member`}
                value={formData.member}
                onChange={e =>
                  setFormData(prev => ({ ...prev, member: e.target.value }))
                }
                placeholder="e.g., us-gaap:EntityAxisMember (optional, leave empty for wildcard)"
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-member-label`}>Member Label</Label>
              <Input
                id={`${idPrefix}-member-label`}
                value={formData.member_label}
                onChange={e =>
                  setFormData(prev => ({
                    ...prev,
                    member_label: e.target.value,
                  }))
                }
                placeholder="e.g., Entity Member Label (optional, leave empty for wildcard)"
              />
            </div>
          </>
        )}

        <div>
          <Label htmlFor={`${idPrefix}-normalized-axis-label`}>
            Normalized Axis Label *
          </Label>
          <Input
            id={`${idPrefix}-normalized-axis-label`}
            value={formData.normalized_axis_label}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                normalized_axis_label: e.target.value,
              }))
            }
            placeholder="e.g., Entity"
          />
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-normalized-member-label`}>
            Normalized Member Label
          </Label>
          <Input
            id={`${idPrefix}-normalized-member-label`}
            value={formData.normalized_member_label}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                normalized_member_label: e.target.value,
              }))
            }
            placeholder="e.g., Normalized Member Label (optional)"
          />
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-tags`}>Tags</Label>
          <Input
            id={`${idPrefix}-tags`}
            value={formData.tags}
            onChange={e =>
              setFormData(prev => ({ ...prev, tags: e.target.value }))
            }
            placeholder="e.g., tag1,tag2,tag3 (comma-separated)"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Comma-separated list of tags
          </p>
        </div>
      </div>
    );
  }
);
