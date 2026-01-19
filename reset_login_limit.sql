-- 重置用户的密码登录限制
-- 清除指定用户的登录历史记录

-- 方法1：清除特定用户的密码登录历史
DELETE FROM login_histories 
WHERE user_id = 2 AND login_type = 'password';

-- 方法2：清除特定用户的所有登录历史
-- DELETE FROM login_histories WHERE user_id = 2;

-- 方法3：清除所有用户的登录历史（谨慎使用）
-- DELETE FROM login_histories;

-- 查看用户的登录历史统计
SELECT 
    user_id,
    login_type,
    success,
    COUNT(*) as count,
    MAX(created_at) as last_login
FROM login_histories 
WHERE user_id = 2 
GROUP BY user_id, login_type, success
ORDER BY last_login DESC;