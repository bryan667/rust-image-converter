use std::io::Cursor;
use std::alloc::{alloc, dealloc, Layout};
use std::ffi::c_void;
use std::ptr::{self, null_mut};

use image::codecs::jpeg::JpegEncoder;
use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::imageops::FilterType as ResizeFilter;
use image::{ColorType, DynamicImage, GenericImageView, ImageEncoder};
use wasm_bindgen::prelude::*;

type CmpFn = extern "C" fn(*const c_void, *const c_void) -> i32;

#[inline]
unsafe fn allocation_layout(payload_size: usize) -> Option<Layout> {
    let total = payload_size.checked_add(std::mem::size_of::<usize>())?;
    Layout::from_size_align(total.max(std::mem::size_of::<usize>()), std::mem::align_of::<usize>())
        .ok()
}

#[no_mangle]
pub unsafe extern "C" fn malloc(size: usize) -> *mut c_void {
    let Some(layout) = allocation_layout(size) else {
        return null_mut();
    };
    let base = alloc(layout);
    if base.is_null() {
        return null_mut();
    }
    ptr::write(base.cast::<usize>(), size);
    base.add(std::mem::size_of::<usize>()).cast::<c_void>()
}

#[no_mangle]
pub unsafe extern "C" fn calloc(count: usize, size: usize) -> *mut c_void {
    let Some(total) = count.checked_mul(size) else {
        return null_mut();
    };
    let ptr = malloc(total);
    if !ptr.is_null() {
        ptr::write_bytes(ptr.cast::<u8>(), 0, total);
    }
    ptr
}

#[no_mangle]
pub unsafe extern "C" fn free(ptr: *mut c_void) {
    if ptr.is_null() {
        return;
    }
    let header_size = std::mem::size_of::<usize>();
    let base = ptr.cast::<u8>().sub(header_size);
    let payload_size = ptr::read(base.cast::<usize>());
    let Some(layout) = allocation_layout(payload_size) else {
        return;
    };
    dealloc(base, layout);
}

#[no_mangle]
pub unsafe extern "C" fn qsort(base: *mut c_void, nmemb: usize, size: usize, compar: CmpFn) {
    if base.is_null() || nmemb <= 1 || size == 0 {
        return;
    }
    let bytes = base.cast::<u8>();
    for i in 0..nmemb {
        for j in 0..(nmemb - 1 - i) {
            let a = bytes.add(j * size);
            let b = bytes.add((j + 1) * size);
            if compar(a.cast::<c_void>(), b.cast::<c_void>()) > 0 {
                for k in 0..size {
                    let pa = a.add(k);
                    let pb = b.add(k);
                    let tmp = ptr::read(pa);
                    ptr::write(pa, ptr::read(pb));
                    ptr::write(pb, tmp);
                }
            }
        }
    }
}

#[no_mangle]
pub unsafe extern "C" fn bsearch(
    key: *const c_void,
    base: *const c_void,
    nmemb: usize,
    size: usize,
    compar: CmpFn,
) -> *mut c_void {
    if key.is_null() || base.is_null() || size == 0 {
        return null_mut();
    }
    let bytes = base.cast::<u8>();
    for i in 0..nmemb {
        let current = bytes.add(i * size);
        if compar(key, current.cast::<c_void>()) == 0 {
            return current.cast::<c_void>().cast_mut();
        }
    }
    null_mut()
}

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
            let encoder = webp::Encoder::from_rgba(rgba.as_raw(), rgba.width(), rgba.height());
            let encoded = if lossless {
                encoder.encode_lossless()
            } else {
                encoder.encode(clamped_quality as f32)
            };
            output.extend_from_slice(encoded.as_ref());
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
