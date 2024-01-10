import {Component, Input} from '@angular/core';
import {EditorService} from '../../../services/editor_service';
import {mapComponentToObject} from '../../services/logger';
import {mapComponentObjectToDisplay} from '../../component_tree/component_tree';
import {ObjectTree} from '../../object_tree/object_tree';
import {
  FieldType,
  EditorField,
  EditorEvent,
  EditorUpdateCallsite,
  ArgPath,
  ArgPathSegment,
  CodeValue,
  LiteralElement,
} from 'mesop/mesop/protos/ui_jspb_proto_pb/mesop/protos/ui_pb';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatDividerModule} from '@angular/material/divider';
import {MatCheckboxChange, MatCheckboxModule} from '@angular/material/checkbox';
import {MatSelectModule} from '@angular/material/select';
import {CommonModule} from '@angular/common';
import {Channel} from '../../../services/channel';

@Component({
  selector: 'mesop-editor-fields',
  templateUrl: 'editor_fields.ng.html',
  styleUrl: 'editor_fields.css',
  standalone: true,
  imports: [
    ObjectTree,
    MatFormFieldModule,
    MatInputModule,
    MatDividerModule,
    MatCheckboxModule,
    MatSelectModule,
    CommonModule,
  ],
})
export class EditorFields {
  @Input()
  fields!: EditorField[];

  @Input()
  prefixes: string[] = [];

  FieldTypeCase = FieldType.TypeCase;

  constructor(
    private editorService: EditorService,
    private channel: Channel,
  ) {}

  onNewProperty(event: Event) {
    const target = event.target as HTMLSelectElement;
    const segment = new ArgPathSegment();
    segment.setKeywordArgument(target.value);
    const type = this.fields
      .find((f) => f.getName() === target.value)!
      .getType()!;
    this.dispatchEdit(segment, getCodeFromType(type));
  }

  onSelectLiteral(event: Event) {
    const target = event.target as HTMLSelectElement;
    const segment = new ArgPathSegment();
    const name = target.getAttribute('data-name');
    if (!name) {
      throw new Error('Expected to get data-name attribute from event.');
    }
    segment.setKeywordArgument(name);

    const literalIndex = Number(target.value);
    const literal = this.fields
      .find((f) => f.getName() === name)!
      .getType()!
      .getLiteralType()!
      .getLiteralsList()[literalIndex];

    this.dispatchEdit(segment, getLiteralCodeValue(literal));
  }

  onCheckboxChange(event: MatCheckboxChange) {
    const target = event.source;
    const segment = new ArgPathSegment();
    const name = target.value;
    if (!name) {
      throw new Error('Expected to get name.');
    }
    segment.setKeywordArgument(name);

    const codeValue = new CodeValue();
    codeValue.setBoolValue(event.checked);
    this.dispatchEdit(segment, codeValue);
  }

  onBlur(event: FocusEvent) {
    const target = event.target as HTMLInputElement;
    const segment = new ArgPathSegment();
    const name = target.getAttribute('data-name');
    if (!name) {
      throw new Error('Expected to get data-name attribute from event.');
    }
    segment.setKeywordArgument(name);
    const codeValue = new CodeValue();
    codeValue.setStringValue(target.value);
    this.dispatchEdit(segment, codeValue);
  }

  private dispatchEdit(argPathSegment: ArgPathSegment, newCode: CodeValue) {
    const editorEvent = new EditorEvent();
    const editorUpdate = new EditorUpdateCallsite();
    editorEvent.setUpdateCallsite(editorUpdate);
    editorUpdate.setSourceCodeLocation(
      this.editorService.getFocusedComponent()!.getSourceCodeLocation(),
    );
    editorUpdate.setComponentName(
      this.editorService.getFocusedComponent()!.getType()!.getName(),
    );
    const argPath = new ArgPath();
    for (const prefix of this.prefixes) {
      const segment = new ArgPathSegment();
      segment.setKeywordArgument(prefix);
      argPath.addSegments(segment);
    }
    argPath.addSegments(argPathSegment);
    editorUpdate.setArgPath(argPath);
    editorUpdate.setNewCode(newCode);
    this.channel.dispatchEditorEvent(editorEvent);
  }

  getFocusedComponent() {
    const obj = mapComponentToObject(this.editorService.getFocusedComponent()!);
    const display = mapComponentObjectToDisplay(obj);
    return display;
  }

  getFieldsForListField(field: EditorField): EditorField[] {
    return (
      field
        .getType()!
        .getListType()!
        .getType()!
        .getStructType()!
        .getFieldsList() ?? []
    );
  }

  getRegularFields(): EditorField[] {
    return (
      this.fields.filter(
        (field) =>
          field.getType()?.getTypeCase() !== this.FieldTypeCase.BOOL_TYPE &&
          field.getType() &&
          this.getValueFor(field.getName()),
      ) ?? []
    );
  }

  getHiddenFields() {
    return (
      this.fields
        .filter(
          (field) =>
            field.getType()?.getTypeCase() !== this.FieldTypeCase.BOOL_TYPE &&
            field.getType() &&
            !this.getValueFor(field.getName()),
        )
        .map((field) => field.getName()) ?? []
    );
  }

  getBoolFields(): EditorField[] {
    return (
      this.fields.filter(
        (field) =>
          field.getType()?.getTypeCase() === this.FieldTypeCase.BOOL_TYPE,
      ) ?? []
    );
  }

  getNonTypedFields(): EditorField[] {
    return this.fields.filter((field) => !field.getType()) ?? [];
  }

  getPrefixFor(fieldName: string) {
    return [...this.prefixes, fieldName];
  }

  getValueFor(fieldName: string) {
    let valueObj = this.getFocusedComponent().properties['value' as any];
    for (const prefix of this.prefixes) {
      valueObj = valueObj[prefix as any];
      if (!valueObj) {
        return '';
      }
    }
    const value = valueObj[fieldName as any] ?? '';
    return value;
  }

  getLiteralValue(literal: LiteralElement): string {
    switch (literal.getLiteralCase()) {
      case LiteralElement.LiteralCase.INT_LITERAL:
        return literal.getIntLiteral().toString();
      case LiteralElement.LiteralCase.STRING_LITERAL:
        return literal.getStringLiteral();
      case LiteralElement.LiteralCase.LITERAL_NOT_SET:
        throw new Error(`Unhandled literal element case ${literal.toObject()}`);
    }
  }
}
function getCodeFromType(type: FieldType): CodeValue {
  const newCode = new CodeValue();
  switch (type!.getTypeCase()) {
    case FieldType.TypeCase.STRUCT_TYPE:
      newCode.setStructName(type.getStructType()!.getStructName());
      return newCode;
    case FieldType.TypeCase.STRING_TYPE:
      newCode.setStringValue(type.getStringType()!.getDefaultValue());
      return newCode;
    case FieldType.TypeCase.BOOL_TYPE:
      newCode.setBoolValue(type.getBoolType()!.getDefaultValue());
      return newCode;
    case FieldType.TypeCase.INT_TYPE:
      newCode.setIntValue(type.getIntType()!.getDefaultValue());
      return newCode;
    case FieldType.TypeCase.FLOAT_TYPE:
      newCode.setDoubleValue(type.getFloatType()!.getDefaultValue());
      return newCode;
    case FieldType.TypeCase.LITERAL_TYPE: {
      const defaultLiteral = type.getLiteralType()!.getLiteralsList()[0];
      return getLiteralCodeValue(defaultLiteral);
    }
    case FieldType.TypeCase.LIST_TYPE:
      newCode.setStructName(
        type.getListType()!.getType()!.getStructType()!.getStructName(),
      );
      return newCode;
    case FieldType.TypeCase.TYPE_NOT_SET:
      throw new Error('Unexpected type not set');
  }
}
function getLiteralCodeValue(defaultLiteral: LiteralElement): CodeValue {
  const newCode = new CodeValue();
  switch (defaultLiteral.getLiteralCase()) {
    case LiteralElement.LiteralCase.INT_LITERAL:
      newCode.setIntValue(defaultLiteral.getIntLiteral());
      return newCode;
    case LiteralElement.LiteralCase.STRING_LITERAL:
      newCode.setStringValue(defaultLiteral.getStringLiteral());
      return newCode;
    case LiteralElement.LiteralCase.LITERAL_NOT_SET:
      throw new Error('Unexpected unset literal case');
  }
}
