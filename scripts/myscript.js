
var obox1 = document.createElement("div")
obox1.innerHTML = '<img src = "/img/qrcode.png" width = "275" height = "300" />';
obox1.style.position = "fixed";
obox1.style.right = "10px";
obox1.style.bottom = "10px";
obox1.style.display = "none";

obox1.setAttribute("class", "movie")

var obox2 = document.createElement("div")
obox2.innerHTML = '<img src = "/img/movie.jpeg" width = "275" height = "370" />';
obox2.style.position = "fixed";
obox2.style.bottom = "0px";
obox2.style.left = "0px";
obox2.style.zIndex = "9999";
obox2.style.display = "none";

var sbox = document.getElementsByTagName("body")[0];
sbox.appendChild(obox1);

var rand = Math.random();
console.log(rand);

if (rand > 0.5) {
    sbox.appendChild(obox2);
    setTimeout(function(){
        obox2.style.display = "block";
        setTimeout(function(){
            obox2.style.display = "none";
        }, 30000)
    }, 5000)
}

