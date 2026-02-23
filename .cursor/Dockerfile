# Base environment for Cursor cloud/background agents.
# Do NOT copy app code — the agent clones the repo. Only install dev tools.

FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    # Playwright (optional; remove if agents don't run e2e)
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Non-root user and home WORKDIR (Cursor recommendation)
ARG USER=ubuntu
ARG UID=1000
RUN useradd -m -u "${UID}" -s /bin/bash "${USER}"
USER "${USER}"
WORKDIR /home/${USER}

# Global dev tools agents may need (optional)
# RUN npm install -g prisma tsx
