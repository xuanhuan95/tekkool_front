let _getValueById = (id) => (document.getElementById(id) && document.getElementById(id).value) ? document.getElementById(id).value : '';

let _numToChar = (n) => {
    //convert int to string uppercase
    return String.fromCharCode(65 + n);
};

export var getValueById = _getValueById;
export var numToChar = _numToChar;

