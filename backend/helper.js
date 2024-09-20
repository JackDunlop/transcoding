const { randUserName, randEmail, randPastDate, randFullName, randNumber, randPassword } = require('@ngneat/falso');
const { format } = require('date-fns');

const usedUsernames = new Set();
const usedEmails = new Set();

function generateUniqueUsername() {
    let username;
    do {
        username = randUserName();
    } while (usedUsernames.has(username));
    usedUsernames.add(username);
    return username;
}

function generateUniqueEmail() {
    let email;
    do {
        email = randEmail();
    } while (usedEmails.has(email));
    usedEmails.add(email);
    return email;
}

module.exports = {




    generateUserData: function (context, events, done) {
        const username = generateUniqueUsername();
        const email = generateUniqueEmail();
        const DOB = format(randPastDate(), 'yyyy-MM-dd');
        const fullname = randFullName();
        const password = randPassword();

        context.vars.username = username;
        context.vars.email = email;
        context.vars.DOB = DOB;
        context.vars.fullname = fullname;
        context.vars.password = password;
        return done();
    },

    addAuthHeader: function (context, events, done) {
        context.vars.authHeaders = {
            Authorization: `Bearer ${context.vars.jwtToken}`
        };
        return done();
    }



};
