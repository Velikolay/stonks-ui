"use client";

import React from "react";
import { StatementType } from "@/lib/services/admin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATEMENT_TYPES: StatementType[] = [
  "Income Statement",
  "Balance Sheet",
  "Cash Flow Statement",
  "Comprehensive Income",
  "Statement of Equity",
];

export type WeightOption = "__none__" | "-1" | "1";
export type UnitOption = "__none__" | "usd" | "usdPerShare";

export type OverrideFormData = {
  concept: string;
  statement: StatementType;
  normalized_label: string;
  is_abstract: boolean;
  parent_concept: string;
  abstract_concept: string;
  weight: WeightOption;
  unit: UnitOption;
  description: string;
};

interface ConceptNormalizationFormProps {
  mode: "create" | "edit";
  formData: OverrideFormData;
  setFormData: React.Dispatch<React.SetStateAction<OverrideFormData>>;
  parentConceptPlaceholder: string;
  abstractConceptPlaceholder: string;
}

export const ConceptNormalizationForm = React.memo(
  function ConceptNormalizationForm({
    mode,
    formData,
    setFormData,
    parentConceptPlaceholder,
    abstractConceptPlaceholder,
  }: ConceptNormalizationFormProps) {
    const idPrefix = mode;
    const isEdit = mode === "edit";
    const disableAbstractOnlyFields = formData.is_abstract;

    return (
      <div className="space-y-4">
        {isEdit ? (
          <>
            <div>
              <Label>Concept</Label>
              <Input value={formData.concept} disabled className="bg-muted" />
            </div>
            <div>
              <Label>Statement</Label>
              <Input value={formData.statement} disabled className="bg-muted" />
            </div>
          </>
        ) : (
          <>
            <div>
              <Label htmlFor={`${idPrefix}-concept`}>Concept *</Label>
              <Input
                id={`${idPrefix}-concept`}
                value={formData.concept}
                onChange={e =>
                  setFormData(prev => ({ ...prev, concept: e.target.value }))
                }
                placeholder="e.g., us-gaap:Revenues"
              />
            </div>
            <div>
              <Label htmlFor={`${idPrefix}-statement`}>Statement *</Label>
              <Select
                value={formData.statement}
                onValueChange={value =>
                  setFormData(prev => ({
                    ...prev,
                    statement: value as StatementType,
                  }))
                }
              >
                <SelectTrigger id={`${idPrefix}-statement`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATEMENT_TYPES.map(stmt => (
                    <SelectItem key={stmt} value={stmt}>
                      {stmt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div>
          <Label htmlFor={`${idPrefix}-normalized-label`}>
            Normalized Label *
          </Label>
          <Input
            id={`${idPrefix}-normalized-label`}
            value={formData.normalized_label}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                normalized_label: e.target.value,
              }))
            }
            placeholder="e.g., Revenue"
          />
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id={`${idPrefix}-is-abstract`}
            checked={formData.is_abstract}
            onChange={e => {
              const checked = e.target.checked;
              setFormData(prev => {
                if (checked) {
                  return {
                    ...prev,
                    is_abstract: true,
                    parent_concept: "",
                    weight: "__none__",
                    unit: "__none__",
                  };
                }
                return {
                  ...prev,
                  is_abstract: false,
                  weight: "1",
                  unit: "usd",
                };
              });
            }}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor={`${idPrefix}-is-abstract`} className="cursor-pointer">
            Is Abstract
          </Label>
        </div>

        <div className={disableAbstractOnlyFields ? "opacity-50" : ""}>
          <Label htmlFor={`${idPrefix}-parent-concept`}>Parent Concept</Label>
          <Input
            id={`${idPrefix}-parent-concept`}
            value={formData.parent_concept}
            onChange={e =>
              setFormData(prev => ({ ...prev, parent_concept: e.target.value }))
            }
            placeholder={parentConceptPlaceholder}
            disabled={disableAbstractOnlyFields}
            className={disableAbstractOnlyFields ? "bg-muted" : ""}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Must reference an existing override&apos;s (concept, statement) pair
          </p>
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-abstract-concept`}>
            Abstract Concept
          </Label>
          <Input
            id={`${idPrefix}-abstract-concept`}
            value={formData.abstract_concept}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                abstract_concept: e.target.value,
              }))
            }
            placeholder={abstractConceptPlaceholder}
          />
          <p className="text-xs text-muted-foreground mt-1">
            Must reference an existing override&apos;s (concept, statement) pair
          </p>
        </div>

        <div className={disableAbstractOnlyFields ? "opacity-50" : ""}>
          <Label htmlFor={`${idPrefix}-weight`}>Weight</Label>
          <Select
            value={formData.weight}
            disabled={disableAbstractOnlyFields}
            onValueChange={value =>
              setFormData(prev => ({ ...prev, weight: value as WeightOption }))
            }
          >
            <SelectTrigger id={`${idPrefix}-weight`}>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              <SelectItem value="-1">-1</SelectItem>
              <SelectItem value="1">1</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className={disableAbstractOnlyFields ? "opacity-50" : ""}>
          <Label htmlFor={`${idPrefix}-unit`}>Unit</Label>
          <Select
            value={formData.unit}
            disabled={disableAbstractOnlyFields}
            onValueChange={value =>
              setFormData(prev => ({ ...prev, unit: value as UnitOption }))
            }
          >
            <SelectTrigger id={`${idPrefix}-unit`}>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              <SelectItem value="usd">usd</SelectItem>
              <SelectItem value="usdPerShare">usdPerShare</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-description`}>Description</Label>
          <Input
            id={`${idPrefix}-description`}
            value={formData.description}
            onChange={e =>
              setFormData(prev => ({ ...prev, description: e.target.value }))
            }
            placeholder="Optional description"
          />
        </div>
      </div>
    );
  }
);
