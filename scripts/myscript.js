
var obox1 = document.createElement("div")
obox1.innerHTML = '<img src = "/img/movie.jpeg" width = "275" height = "370" />';
obox1.style.position = "fixed";
obox1.style.right = "20px";
obox1.style.bottom = "0px";
obox1.style.display = "none";

obox1.setAttribute("class", "movie")

var obox2 = document.createElement("div")
obox2.innerHTML = '<img src = "/img/support.png" width = "200" height = "90" />';
obox2.style.position = "fixed";
obox2.style.bottom = "0px";
obox2.style.left = "0px";
obox2.style.display = "none";

var sbox = document.getElementsByTagName("body")[0];
sbox.appendChild(obox1);

if (Math.random() > 0.7) {
    sbox.appendChild(obox2);
    setTimeout(function(){
        obox2.style.display = "block";
        setTimeout(function(){
            obox2.style.display = "none";
        }, 10000)
    }, 5000)
}

