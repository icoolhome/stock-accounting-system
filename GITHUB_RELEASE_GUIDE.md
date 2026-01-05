# GitHub Releases 雿輻??

## 憒???GitHub Releases 銝剜溶???祆?隞?
?嗆??GitHub 銝撱箸??Release ???臭誑撠??祆?隞園?? Release 銝准誑銝閰喟敦甇仿?嚗?
## 甇仿? 1嚗????祆?隞?
蝣箔?隞乩??辣撌脩??典澈銝凋蒂撌脫?鈭歹?

1. **RELEASE_NOTES.md** - Release 隤芣??辣嚗???GitHub Releases 皞?嚗?2. **CHANGELOG.md** - 摰???湔隤?3. **README_VERSION.md** - ?閰喟敦隤芣??辣

## 甇仿? 2嚗撱?GitHub Release

### ?寞?銝嚗? GitHub Web ?

1. 閮芸??函? GitHub ?澈
2. 暺??喳??**"Releases"** ?嚗??湔閮芸?嚗https://github.com/YOUR_USERNAME/YOUR_REPO/releases`
3. 暺? **"Draft a new release"** ??**"Create a new release"**
4. 憛怠神 Release 靽⊥嚗?   - **Tag version**: 頛詨璅惜?迂嚗?憒?`vS0002-1`
   - **Release title**: 頛詨璅?嚗?憒?`vS0002-1 - ?扯?芸??I?寥深
   - **Description**: 銴ˊ `RELEASE_NOTES.md` ?摰孵?ㄐ嚗???亙神?交?啗牧??5. ?舫嚗???隞塚?閬郊撽?3嚗?6. 暺? **"Publish release"**

### ?寞?鈭?雿輻 GitHub CLI

```bash
# 雿輻 GitHub CLI ?萄遣 Release
gh release create vS0002-1 \
  --title "vS0002-1 - ?扯?芸??I?寥? \
  --notes-file RELEASE_NOTES.md \
  --target master
```

### ?寞?銝?雿輻 Git ?賭誘嚗?閬?蝵?GitHub API嚗?
憒??其蝙??GitHub API嚗隞仿? API ?萄遣 Release 銝阡???隞嗚?
## 甇仿? 3嚗????祆?隞嗅 Release

### ?? Web ????辣

1. ?典撱箸?蝺刻摩 Release ?嚗?銝遝? **"Attach binaries"** ???2. 撠誑銝?隞嗆??曉閰脣???
   - `RELEASE_NOTES.md`
   - `CHANGELOG.md`
   - `README_VERSION.md`
3. ?辣撠◤????Release嚗?嗅隞乩?頛?
### 雿輻 GitHub CLI ???辣

```bash
# ?萄遣 Release 銝阡???隞?gh release create vS0002-1 \
  --title "vS0002-1 - ?扯?芸??I?寥? \
  --notes-file RELEASE_NOTES.md \
  RELEASE_NOTES.md \
  CHANGELOG.md \
  README_VERSION.md \
  --target master
```

### 雿輻 GitHub API ???辣

```bash
# 1. ?萄遣 Release嚗??Release ID嚗?RELEASE_ID=$(gh api repos/:owner/:repo/releases \
  --method POST \
  --field tag_name="vS0002" \
  --field name="vS0002 - 甇瑕?嗥?憓撥?頂蝯梯那?瑟?? \
  --field body="$(cat RELEASE_NOTES.md)" \
  -q '.id')

# 2. 銝?辣
gh api repos/:owner/:repo/releases/$RELEASE_ID/assets \
  --field name="RELEASE_NOTES.md" \
  --field label="Release Notes" \
  --raw-field data=@RELEASE_NOTES.md \
  --header "Content-Type: text/markdown"

gh api repos/:owner/:repo/releases/$RELEASE_ID/assets \
  --field name="CHANGELOG.md" \
  --field label="Changelog" \
  --raw-field data=@CHANGELOG.md \
  --header "Content-Type: text/markdown"

gh api repos/:owner/:repo/releases/$RELEASE_ID/assets \
  --field name="README_VERSION.md" \
  --field label="Version Details" \
  --raw-field data=@README_VERSION.md \
  --header "Content-Type: text/markdown"
```

## 甇仿? 4嚗???單嚗?賂?

?典隞亙撱箔???砌??芸???Release ?萄遣??嚗?
```bash
#!/bin/bash
# create_release.sh

VERSION="vS0002"
REPO_OWNER="YOUR_USERNAME"
REPO_NAME="YOUR_REPO"

# ?萄遣 Release
gh release create $VERSION \
  --title "$VERSION - 甇瑕?嗥?憓撥?頂蝯梯那?瑟?? \
  --notes-file RELEASE_NOTES.md \
  RELEASE_NOTES.md \
  CHANGELOG.md \
  README_VERSION.md \
  --target master

echo "Release $VERSION created successfully!"
```

雿輻?孵?嚗?```bash
chmod +x create_release.sh
./create_release.sh
```

## ?刻??Release 隤芣??澆?

??GitHub Release ??Description 甈?銝哨?撱箄降雿輻隞乩??澆?嚗?
```markdown
## ?? ? vS0002

### ??銝餉??湔

- 甇瑕?嗥?閮?憓撥嚗憓???雿?
- 蝟餌絞閮箸??券?寥?- 璅⊥?蝒蝯曹??舀??

### ?? 閰喟敦隤芣?

[甇方??臭誑蝪∟?隤芣?嚗?撘??冽?亦??辣?辣]

### ?? ?賊??辣

- [Release Notes](RELEASE_NOTES.md)
- [Changelog](CHANGELOG.md)
- [Version Details](README_VERSION.md)
```

## 瘜冽?鈭?

1. **?辣憭批??**嚗itHub Release ?辣憭批????2GB嚗?撠??辣嚗? .md嚗虜銝??
2. **?辣?澆?**嚗遣霅唬蝙??Markdown ?澆?嚗?md嚗?GitHub ??葡??3. **?璅惜**嚗Ⅱ靽?Git 璅惜撌脩??券 GitHub嚗git push origin vS0002`嚗?4. **甈?閬?**嚗?閬??澈?神?交????賢撱?Release

## 撽? Release

?萄遣 Release 敺?閮芸?隞乩? URL 撽?嚗?
```
https://github.com/YOUR_USERNAME/YOUR_REPO/releases/tag/vS0002
```

?冽?閰脰?嚗?- Release 璅??牧??- ????隞嗅?銵?- ?臭誑銝???隞園??





