// Run only from a trusted machine with Application Default Credentials.
// node grant-admin.cjs FIREBASE_AUTH_UID [grant|revoke]
'use strict';
const {initializeApp}=require('firebase-admin/app'),{getAuth}=require('firebase-admin/auth'),{getDatabase}=require('firebase-admin/database');
initializeApp({databaseURL:process.env.FIREBASE_DATABASE_URL||'https://aopvman-default-rtdb.firebaseio.com'});
(async()=>{const [uid,mode='grant']=process.argv.slice(2);if(!uid||!['grant','revoke'].includes(mode))throw new Error('Cần UID và grant/revoke.');const user=await getAuth().getUser(uid),enabled=mode==='grant';await getDatabase().ref('admin_access/'+uid).set(enabled);await getAuth().setCustomUserClaims(uid,{...user.customClaims,admin:enabled});if(!enabled)await getAuth().revokeRefreshTokens(uid);console.log(enabled?'Đã cấp quyền Admin. Đăng nhập lại để nhận quyền.':'Đã thu hồi quyền Admin.');process.exit(0);})().catch(err=>{console.error(err.message);process.exit(1);});
