window.onload = function() {
    var obox = document.createElement("div")
    obox.innerHTML = '<a href="https://u.jd.com/Uj4bve" title="ElasticSearch源码解析与优化实践">' + 
                        '<img src = "./elasticsearch.jpg" width = "250" height = "250" />' +
                     '</a>';
    obox.style.position = "fixed";
    obox.style.right = "20px";
    obox.style.bottom = "100px";

    var sbox = document.getElementsByClassName("page-inner")[0];
    sbox.appendChild(obox);
}