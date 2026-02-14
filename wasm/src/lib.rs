use std::io::Cursor;

use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::codecs::webp::WebPEncoder;
use image::imageops::FilterType as ResizeFilter;
use image::{ColorType, DynamicImage, GenericImageView, ImageEncoder};
use wasm_bindgen::prelude::*;

fn map_error(message: String) -> JsValue {
    JsValue::from_str(&message)
}

fn resize_if_needed(image: DynamicImage, max_width: u32, max_height: u32) -> DynamicImage {
    if max_width == 0 && max_height == 0 {
        return image;
    }

    let (width, height) = image.dimensions();
    let target_width = if max_width == 0 { width } else { max_width };
    let target_height = if max_height == 0 { height } else { max_height };

    if width <= target_width && height <= target_height {
        return image;
    }

    image.resize(target_width, target_height, ResizeFilter::Lanczos3)
}

fn encode_image(
    image: DynamicImage,
    target_format: &str,
    quality: u8,
    lossless: bool,
) -> Result<Vec<u8>, String> {
    let mut output = Vec::new();
    let mut cursor = Cursor::new(&mut output);
    let target = target_format.to_lowercase();
    let clamped_quality = quality.clamp(1, 100);

    match target.as_str() {
        "png" => {
            let rgba = image.to_rgba8();
            let encoder = PngEncoder::new_with_quality(
                &mut cursor,
                CompressionType::Best,
                FilterType::Adaptive,
            );
            encoder
                .write_image(&rgba, rgba.width(), rgba.height(), ColorType::Rgba8.into())
                .map_err(|error| error.to_string())?;
        }
        "jpg" | "jpeg" => {
            let rgb = image.to_rgb8();
            let effective_quality = if lossless { 100 } else { clamped_quality };
            let mut encoder = JpegEncoder::new_with_quality(&mut cursor, effective_quality);
            encoder
                .encode(&rgb, rgb.width(), rgb.height(), ColorType::Rgb8.into())
                .map_err(|error| error.to_string())?;
        }
        "webp" => {
            let rgba = image.to_rgba8();
            let encoder = WebPEncoder::new_lossless(&mut cursor);
            encoder
                .encode(&rgba, rgba.width(), rgba.height(), ColorType::Rgba8.into())
                .map_err(|error| error.to_string())?;
        }
        _ => return Err(format!("Unsupported target format: {target_format}")),
    }

    Ok(output)
}

#[wasm_bindgen]
pub fn convert_image(input: &[u8], target_format: &str) -> Result<Vec<u8>, JsValue> {
    let image = image::load_from_memory(input).map_err(|error| map_error(error.to_string()))?;
    encode_image(image, target_format, 78, false).map_err(map_error)
}

#[wasm_bindgen]
pub fn convert_image_with_options(
    input: &[u8],
    target_format: &str,
    quality: u8,
    max_width: u32,
    max_height: u32,
    lossless: bool,
) -> Result<Vec<u8>, JsValue> {
    let image = image::load_from_memory(input).map_err(|error| map_error(error.to_string()))?;
    let resized = resize_if_needed(image, max_width, max_height);
    encode_image(resized, target_format, quality, lossless).map_err(map_error)
}
