import type { Schema, Struct } from '@strapi/strapi';

export interface SliderSlide extends Struct.ComponentSchema {
  collectionName: 'components_slider_slides';
  info: {
    displayName: 'Slide';
    icon: 'landscape';
  };
  attributes: {
    Accroche: Schema.Attribute.Blocks;
    Image: Schema.Attribute.Media<'images' | 'files' | 'videos' | 'audios'> &
      Schema.Attribute.Required;
    Position: Schema.Attribute.Enumeration<
      [
        'top-left',
        'top-center',
        'top-right',
        'center-left',
        'center',
        'center-right',
        'bottom-left',
        'bottom-center',
        'bottom-right',
      ]
    > &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'bottom-left'>;
    Project: Schema.Attribute.Relation<'oneToOne', 'api::project.project'>;
    Theme: Schema.Attribute.Enumeration<['light', 'dark']> &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'light'>;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'slider.slide': SliderSlide;
    }
  }
}
