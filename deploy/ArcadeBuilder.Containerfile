FROM rust:1.97.1-slim-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends clang libclang-dev pkg-config protobuf-compiler && rm -rf /var/lib/apt/lists/*
ENV RUSTUP_TOOLCHAIN=1.97.1 CARGO_PROFILE_DEV_DEBUG=0 CARGO_TARGET_DIR=/build/target
WORKDIR /work
CMD ["cargo", "build", "--locked", "--manifest-path", "games/arcade/Cargo.toml"]
