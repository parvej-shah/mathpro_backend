const Service = require('../base').Service;
const bcrypt=require('bcryptjs')
const JWT = require('jsonwebtoken');
const { default: axios } = require('axios');
const crypto = require('crypto');

class AuthService extends Service {
    constructor() {
        super();
    }

    signToken = user =>{
        return JWT.sign(user, process.env.JWT_SECRET);
    }

    normalizeEmail = (email) => {
        if (!email || typeof email !== 'string') return null;
        const normalized = email.trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(normalized) ? normalized : null;
    }

    verifyGoogleToken = async (idToken) => {
        if (!idToken || typeof idToken !== 'string') {
            return {
                success: false,
                error: 'Google id_token is required'
            };
        }

        try {
            const response = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
                params: { id_token: idToken },
                timeout: 10000
            });

            const tokenInfo = response.data || {};
            const email = this.normalizeEmail(tokenInfo.email);
            const emailVerified = `${tokenInfo.email_verified}` === 'true';
            const configuredClientId = process.env.GOOGLE_CLIENT_ID?.trim();

            if (configuredClientId && tokenInfo.aud !== configuredClientId) {
                return {
                    success: false,
                    error: 'Google token audience mismatch'
                };
            }

            if (!email) {
                return {
                    success: false,
                    error: 'Google account email is missing or invalid'
                };
            }

            if (!emailVerified) {
                return {
                    success: false,
                    error: 'Google account email is not verified'
                };
            }

            return {
                success: true,
                data: {
                    email,
                    name: tokenInfo.name || email.split('@')[0],
                    sub: tokenInfo.sub,
                    picture: tokenInfo.picture || null
                }
            };
        } catch (error) {
            const googleError = error?.response?.data?.error_description || error?.response?.data?.error;
            return {
                success: false,
                error: googleError || 'Failed to verify Google token'
            };
        }
    }

    buildTokenPayload = (user) => ({
        id: user.id,
        name: user.name,
        login: user.login,
        createdAt: Date.now()
    })

    register=async (reqObj)=>{
        const salt = await bcrypt.genSalt(10)
        const hashedPass = await bcrypt.hash(reqObj.password,salt)
        var query=`INSERT INTO in_auth(name,login,password) VALUES($1,$2,$3) returning id`
        var params=[reqObj.name,reqObj.login,hashedPass]
        var result=await this.query(query,params)
        if(result.success){
            var tokenObject=this.buildTokenPayload({
                id: result.data[0].id,
                name: reqObj.name,
                login: reqObj.login
            })
            const token=this.signToken(tokenObject)
            return{
                success:true,
                token
            }
        }
        return result
    }

    login=async ({login,password})=>{
        var loginFindQuery=`SELECT * FROM in_auth WHERE login = $1`
        var loginFindParams=[login]
        var loginFindResult=await this.query(loginFindQuery,loginFindParams)
        if(loginFindResult.data.length===0)
            return{
                success:false,
                error:'user not found'
            }
        else{
            var hashedPass=loginFindResult.data[0].password
            const isPassValid=await bcrypt.compare(password,hashedPass)
            if(!isPassValid)
                return{
                    success:false,
                    error:'wrong password'
                }
            else{
                var tokenObject=this.buildTokenPayload(loginFindResult.data[0])
                const token=this.signToken(tokenObject)
                return{
                    success:true,
                    token
                }
            }
        }
    }

    googleLogin = async ({ id_token }) => {
        const googleTokenResult = await this.verifyGoogleToken(id_token);
        if (!googleTokenResult.success) {
            return googleTokenResult;
        }

        const { email, name } = googleTokenResult.data;
        const loginFindQuery = `SELECT * FROM in_auth WHERE login = $1`;
        const loginFindResult = await this.query(loginFindQuery, [email]);

        if (loginFindResult.success && loginFindResult.data.length > 0) {
            const tokenObject = this.buildTokenPayload(loginFindResult.data[0]);
            const token = this.signToken(tokenObject);
            return {
                success: true,
                token,
                user: {
                    id: loginFindResult.data[0].id,
                    name: loginFindResult.data[0].name,
                    login: loginFindResult.data[0].login
                }
            };
        }

        const generatedPassword = crypto.randomBytes(32).toString('hex');
        const salt = await bcrypt.genSalt(10);
        const hashedPass = await bcrypt.hash(generatedPassword, salt);
        const createQuery = `
            INSERT INTO in_auth(name,login,password)
            VALUES($1,$2,$3)
            RETURNING id, name, login
        `;
        const createResult = await this.query(createQuery, [name, email, hashedPass]);

        if (!createResult.success || !createResult.data?.length) {
            return {
                success: false,
                error: createResult.error || 'Failed to create Google user'
            };
        }

        const tokenObject = this.buildTokenPayload(createResult.data[0]);
        const token = this.signToken(tokenObject);
        return {
            success: true,
            token,
            user: createResult.data[0]
        };
    }

    
}

module.exports = {AuthService}
