/** The on-device vision-language model: Qwen3-VL 2B Instruct (Apache-2.0), used for both photos and text. */

export interface ModelFile {
  name: string;
  url: string;
  bytes: number;
}

const REPO = 'https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct-GGUF/resolve/main';

export const LOCAL_MODEL = {
  label: 'Qwen3-VL 2B',
  model: {
    name: 'Qwen3VL-2B-Instruct-Q4_K_M.gguf',
    url: `${REPO}/Qwen3VL-2B-Instruct-Q4_K_M.gguf`,
    bytes: 1_107_409_952,
  },
  mmproj: {
    name: 'mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf',
    url: `${REPO}/mmproj-Qwen3VL-2B-Instruct-Q8_0.gguf`,
    bytes: 445_053_216,
  },
} satisfies { label: string; model: ModelFile; mmproj: ModelFile };

export const LOCAL_MODEL_BYTES = LOCAL_MODEL.model.bytes + LOCAL_MODEL.mmproj.bytes;

export const LOCAL_MODEL_LABEL = `on-device · ${LOCAL_MODEL.label}`;
