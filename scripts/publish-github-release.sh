#!/usr/bin/env bash
# 发布 GitHub Release：3 平台安装包 + updater 元数据 (latest*.yml)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST="$ROOT/dist"
VERSION="${1:-2.0.0}"
TAG="v${VERSION}"
REPO="${GITHUB_REPO:-S0x007/cloud-ops-manager}"
NOTES="$ROOT/RELEASE-v${VERSION}.md"
STAGING="$DIST/release-upload"

if [[ ! -f "$NOTES" ]]; then
  echo "缺少发布说明: $NOTES"
  exit 1
fi

if ! command -v gh >/dev/null; then
  echo "请先安装 GitHub CLI: https://cli.github.com/"
  exit 1
fi

mkdir -p "$STAGING"

copy_asset() {
  local src="$1"
  local dest_name="$2"
  if [[ ! -f "$src" ]]; then
    echo "跳过（不存在）: $src"
    return
  fi
  cp "$src" "$STAGING/$dest_name"
  echo "  + $dest_name"
}

echo "==> 准备 Release 附件"
echo "    安装包（3 平台）"
copy_asset "$DIST/Cloud Ops Manager Setup ${VERSION}.exe" "Cloud.Ops.Manager.Setup.${VERSION}.exe"
copy_asset "$DIST/Cloud Ops Manager-${VERSION}-arm64.dmg" "Cloud.Ops.Manager-${VERSION}-arm64.dmg"
copy_asset "$DIST/Cloud Ops Manager-${VERSION}.AppImage" "Cloud.Ops.Manager-${VERSION}.AppImage"

echo "    macOS 应用内更新（zip，可选但推荐）"
copy_asset "$DIST/Cloud Ops Manager-${VERSION}-arm64-mac.zip" "Cloud.Ops.Manager-${VERSION}-arm64-mac.zip"

echo "    electron-updater 元数据"
copy_asset "$DIST/latest.yml" "latest.yml"
copy_asset "$DIST/latest-linux.yml" "latest-linux.yml"
copy_asset "$DIST/latest-mac.yml" "latest-mac.yml"

shopt -s nullglob
assets=("$STAGING"/*)
if [[ ${#assets[@]} -eq 0 ]]; then
  echo "dist/ 下没有可发布的文件，请先: npm run package:all"
  exit 1
fi

echo ""
echo "==> Release: $TAG ($REPO)"
echo "    附件数: ${#assets[@]}"
read -r -p "确认发布？[y/N] " ans
if [[ "${ans,,}" != "y" ]]; then
  echo "已取消"
  exit 0
fi

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  gh release upload "$TAG" "${assets[@]}" --repo "$REPO" --clobber
  gh release edit "$TAG" --repo "$REPO" --notes-file "$NOTES" --draft=false
else
  gh release create "$TAG" "${assets[@]}" \
    --repo "$REPO" \
    --title "Cloud Ops Manager v${VERSION}" \
    --notes-file "$NOTES"
fi

echo ""
echo "完成: https://github.com/$REPO/releases/tag/$TAG"
