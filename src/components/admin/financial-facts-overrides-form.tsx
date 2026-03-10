"use client";

import React from "react";
import { StatementType, STATEMENT_TYPES } from "@/lib/services/protocol";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ToWeightOption = "__none__" | "-1" | "1";

export type FinancialFactsOverrideFormData = {
  concept: string;
  statement: StatementType;
  axis: string;
  member: string;
  label: string;
  form_type: string;
  from_period: string;
  to_period: string;
  to_concept: string;
  to_axis: string;
  to_member: string;
  to_member_label: string;
  to_weight: ToWeightOption;
};

interface FinancialFactsOverridesFormProps {
  mode: "create" | "edit";
  formData: FinancialFactsOverrideFormData;
  setFormData: React.Dispatch<
    React.SetStateAction<FinancialFactsOverrideFormData>
  >;
}

export const FinancialFactsOverridesForm = React.memo(
  function FinancialFactsOverridesForm({
    mode,
    formData,
    setFormData,
  }: FinancialFactsOverridesFormProps) {
    const idPrefix = mode;
    const isEdit = mode === "edit";

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

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${idPrefix}-axis`}>Axis</Label>
            <Input
              id={`${idPrefix}-axis`}
              value={formData.axis}
              onChange={e =>
                setFormData(prev => ({ ...prev, axis: e.target.value }))
              }
              placeholder="e.g., us-gaap:StatementClassOfStockAxis"
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
              placeholder="e.g., us-gaap:CommonStockMember"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${idPrefix}-label`}>Label</Label>
            <Input
              id={`${idPrefix}-label`}
              value={formData.label}
              onChange={e =>
                setFormData(prev => ({ ...prev, label: e.target.value }))
              }
              placeholder="Optional label filter"
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-form-type`}>Form Type</Label>
            <Input
              id={`${idPrefix}-form-type`}
              value={formData.form_type}
              onChange={e =>
                setFormData(prev => ({ ...prev, form_type: e.target.value }))
              }
              placeholder="e.g., 10-K"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${idPrefix}-from-period`}>From Period</Label>
            <Input
              id={`${idPrefix}-from-period`}
              type="date"
              value={formData.from_period}
              onChange={e =>
                setFormData(prev => ({ ...prev, from_period: e.target.value }))
              }
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-to-period`}>To Period</Label>
            <Input
              id={`${idPrefix}-to-period`}
              type="date"
              value={formData.to_period}
              onChange={e =>
                setFormData(prev => ({ ...prev, to_period: e.target.value }))
              }
            />
          </div>
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-to-concept`}>To Concept *</Label>
          <Input
            id={`${idPrefix}-to-concept`}
            value={formData.to_concept}
            onChange={e =>
              setFormData(prev => ({ ...prev, to_concept: e.target.value }))
            }
            placeholder="e.g., stonks:Revenue"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor={`${idPrefix}-to-axis`}>To Axis</Label>
            <Input
              id={`${idPrefix}-to-axis`}
              value={formData.to_axis}
              onChange={e =>
                setFormData(prev => ({ ...prev, to_axis: e.target.value }))
              }
              placeholder="Optional target axis"
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-to-member`}>To Member</Label>
            <Input
              id={`${idPrefix}-to-member`}
              value={formData.to_member}
              onChange={e =>
                setFormData(prev => ({ ...prev, to_member: e.target.value }))
              }
              placeholder="Optional target member"
            />
          </div>
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-to-member-label`}>To Member Label</Label>
          <Input
            id={`${idPrefix}-to-member-label`}
            value={formData.to_member_label}
            onChange={e =>
              setFormData(prev => ({
                ...prev,
                to_member_label: e.target.value,
              }))
            }
            placeholder="Optional target member label"
          />
        </div>

        <div>
          <Label htmlFor={`${idPrefix}-to-weight`}>To Weight</Label>
          <Select
            value={formData.to_weight}
            onValueChange={value =>
              setFormData(prev => ({
                ...prev,
                to_weight: value as ToWeightOption,
              }))
            }
          >
            <SelectTrigger id={`${idPrefix}-to-weight`}>
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              <SelectItem value="-1">-1</SelectItem>
              <SelectItem value="1">1</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  }
);
