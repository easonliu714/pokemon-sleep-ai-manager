from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_static_shell_contains_all_public_navigation_and_views():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    public_views = [
        "dashboard", "pokemon", "ingredients", "items", "recipes", "updates",
        "backup", "knowledge", "weekly", "warroom", "collection", "guide",
    ]
    for view in public_views:
        assert f'data-view="{view}"' in html
        assert f'id="{view}"' in html
    assert "本週環境載入中" in html
    assert "戰情室資料載入中" in html
    assert "收集指南載入中" in html


def test_knowledge_page_has_single_static_authority():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    source = (ROOT / "assets/js/shared-knowledge-ui.js").read_text(encoding="utf-8")
    assert html.count('data-view="knowledge"') == 1
    assert html.count('id="knowledge"') == 1
    assert 'id="sharedKnowledgePanel"' in html
    assert "document.getElementById('knowledge')" in source
    assert "document.getElementById('sharedKnowledgePanel')" in source
    assert "document.createElement('button')" not in source
    assert "data.view='encyclopedia'" not in source
    assert "section.id='encyclopedia'" not in source
    assert "encyclopediaNavBtn')?.remove" in source


def test_debug_ui_is_hidden_in_static_html_and_admin_entry_is_in_guide():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    assert 'id="adminAuthPanel"' in html
    assert 'id="updateCenterLiveDebug"' in html
    assert 'data-debug-feature="update-live-debug"' in html
    assert 'class="panel debug-only hidden"' in html
    assert " hidden" in html
    assert "admin-auth.js" in html


def test_identity_review_remains_a_general_user_tool():
    source = (ROOT / "assets/js/admin-auth.js").read_text(encoding="utf-8")
    assert "const DEBUG_LABELS=new Set(['診斷中心']);" in source
    assert "['診斷中心','身份覆核']" not in source
    assert "寶可夢身份覆核等一般工具" in source


def test_development_phase_opens_debug_without_password():
    source = (ROOT / "assets/js/admin-auth.js").read_text(encoding="utf-8")
    assert "const ACCESS_MODE='development-open';" in source
    assert "const DEVELOPMENT_OPEN=ACCESS_MODE==='development-open';" in source
    assert "let authenticated=DEVELOPMENT_OPEN||" in source
    assert "目前為開發模式：診斷與除錯介面已直接開放，不需要管理密碼" in source
    assert "isDevelopmentOpen:()=>DEVELOPMENT_OPEN" in source
    assert "default_password" not in source


def test_local_admin_auth_uses_non_reversible_hash_and_session_scope_for_release_mode():
    source = (ROOT / "assets/js/admin-auth.js").read_text(encoding="utf-8")
    assert "PBKDF2" in source
    assert "SHA-256" in source
    assert "210000" in source
    assert "crypto.getRandomValues" in source
    assert "sessionStorage" in source
    assert "localStorage" in source
    assert "password_hash" in source
    assert "current-password" in source
    assert "update-center-live-debug.js" in source
    assert "default_password" not in source
    assert "admin123" not in source.lower()


def test_admin_credentials_are_not_part_of_database_or_backup_contract():
    source = (ROOT / "assets/js/admin-auth.js").read_text(encoding="utf-8")
    assert "database.js" not in source
    assert "persist(" not in source
    assert "snapshot(" not in source
    assert "CONFIG_KEY='pokemon-sleep-local-admin-auth/1.0'" in source


def test_g3_planning_does_not_duplicate_static_shell():
    source = (ROOT / "assets/js/g3-planning.js").read_text(encoding="utf-8")
    assert "if (!nav.querySelector" in source
    assert "if (!document.getElementById('weekly'))" in source
