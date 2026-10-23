FROM localhost/cellscript-wasm-builder:rust-1.97.1-wasm-bindgen-0.2.121-binaryen-131
USER root
RUN apt-get update && apt-get install -y --no-install-recommends clang libclang-dev pkg-config protobuf-compiler && rm -rf /var/lib/apt/lists/*
ENV RUSTUP_TOOLCHAIN=1.97.1
