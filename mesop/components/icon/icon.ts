import {MatIconModule} from '@angular/material/icon';
import {Component, Input} from '@angular/core';
import {
  Key,
  Type,
} from 'mesop/mesop/protos/ui_jspb_proto_pb/mesop/protos/ui_pb';
import {IconType} from 'mesop/mesop/components/icon/icon_jspb_proto_pb/mesop/components/icon/icon_pb';
import {Channel} from '../../web/src/services/channel';

@Component({
  templateUrl: 'icon.ng.html',
  standalone: true,
  imports: [MatIconModule],
})
export class IconComponent {
  @Input({required: true}) type!: Type;
  @Input() key!: Key;
  private _config!: IconType;

  constructor(private readonly channel: Channel) {}

  ngOnChanges() {
    this._config = IconType.deserializeBinary(
      this.type.getValue() as unknown as Uint8Array,
    );
  }

  config(): IconType {
    return this._config;
  }
}
