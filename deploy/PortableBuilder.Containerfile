FROM rust:1.97.1-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends clang libclang-dev pkg-config protobuf-compiler && rm -rf /var/lib/apt/lists/*
ENV RUSTUP_TOOLCHAIN=1.97.1 CARGO_TARGET_DIR=/work/target CARGO_PROFILE_DEV_DEBUG=0
WORKDIR /work
CMD ["sh", "-c", "cargo build --locked --manifest-path games/chess/Cargo.toml && cargo build --locked --manifest-path games/sling/Cargo.toml"]
