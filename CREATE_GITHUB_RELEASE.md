# ?萄遣 GitHub Release vS0002

## 甇仿?隤芣?

閬 GitHub 銝撱?vS0002 Release嚗?閬??誑銝郊撽?

## 甇仿? 1: ?漱?湔

蝣箔????孵歇?漱嚗?

```bash
cd stock-accounting-system
git add .
git commit -m "?湔???vS0002 銝行?啁??瑼?
```

## 甇仿? 2: ?萄遣 Git 璅惜

```bash
git tag -a vS0002 -m "vS0002 - 甇瑕?嗥?憓撥?頂蝯梯那?瑟??
```

## 甇仿? 3: ?券 GitHub

### 憒?????蝵桅?蝔澈嚗?

```bash
# 瘛餃????澈嚗?撠?YOUR_USERNAME ??REPO_NAME ?踵??箏祕?潘?
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
```

### ?券誨蝣澆?璅惜嚗?

```bash
# ?券蜓?
git push -u origin main
# ??
git push -u origin master

# ?券?蝐?
git push origin vS0002
```

## 甇仿? 4: ?萄遣 GitHub Release

### ?寞?銝嚗蝙??GitHub CLI嚗?佗?

```bash
cd stock-accounting-system
gh release create vS0002 \
  --title "vS0002 - 甇瑕?嗥?憓撥?頂蝯梯那?瑟?? \
  --notes-file RELEASE_NOTES.md \
  RELEASE_NOTES.md \
  CHANGELOG.md \
  README_VERSION.md \
  --target main
```

?蝙??PowerShell ?單嚗?

```powershell
cd stock-accounting-system
.\create_release.ps1
```

### ?寞?鈭?雿輻 GitHub Web ?

1. 閮芸??函? GitHub ?澈
2. 暺??喳??**"Releases"** ?
3. 暺? **"Draft a new release"** ??**"Create a new release"**
4. ?豢?璅惜 `vS0002`嚗???瘝?嚗??萄遣璅惜嚗?
5. 憛怠神 Release 靽⊥嚗?
   - **Release title**: `vS0002 - 甇瑕?嗥?憓撥?頂蝯梯那?瑟?深
   - **Description**: 銴ˊ `RELEASE_NOTES.md` ?摰?
6. ?舫嚗 "Attach binaries" ????單?隞塚?
   - `RELEASE_NOTES.md`
   - `CHANGELOG.md`
   - `README_VERSION.md`
7. 暺? **"Publish release"**

## 撽?

?萄遣??敺?閮芸?嚗?
```
https://github.com/YOUR_USERNAME/REPO_NAME/releases/tag/vS0002
```

?冽?閰脰?嚗?
- Release 璅??牧??
- ????隞嗅?銵剁?憒?銝鈭?
- ?臭誑銝???隞園??

## 瘜冽?鈭?

1. 蝣箔? GitHub CLI 撌脣?鋆蒂撌脩??`gh auth login`
2. 憒?雿輻 PowerShell嚗?賡?閬??瑁?嚗Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`
3. 璅惜敹??? GitHub嚗敺??賢撱?Release
4. 憒?璅惜撌脩?摮嚗itHub CLI ??蝙?函??蝐?





