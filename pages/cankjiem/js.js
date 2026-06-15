const { useState } = React;
const images = [
  { src: "https://i.postimg.cc/1X5zGSHT/storyintro1.jpg", alt: "IMG1", link: "#IMG1" },
  { src: "https://i.postimg.cc/yxQ8nGpN/storyintro2.jpg", alt: "IMG2", link: "#IMG2" },
  { src: "https://i.postimg.cc/mZ8kbcZG/storyintro3.jpg", alt: "IMG3", link: "#IMG3" },
  { src: "https://i.postimg.cc/kXH5bkt1/storyintro4.jpg", alt: "IMG4", link: "#IMG4" },
  { src: "https://i.postimg.cc/8Pc5s1sf/storyintro5.jpg", alt: "IMG5", link: "#IMG5" },
];


const Carousel = () => {
  const [selectedIndex, setSelectedIndex] = useState(3);

  const moveToSelected = (direction) => {
    if (direction === "next") {
      setSelectedIndex((prevIndex) => (prevIndex + 1) % images.length);
    } else if (direction === "prev") {
      setSelectedIndex((prevIndex) =>
        prevIndex === 0 ? images.length - 1 : prevIndex - 1
      );
    }
  };

  const getClassName = (index) => {
    const relativeIndex = (index - selectedIndex + images.length) % images.length;
    if (relativeIndex === 0) return "selected";
    if (relativeIndex === 1) return "next";
    if (relativeIndex === 2) return "nextRightSecond";
    if (relativeIndex === images.length - 1) return "prev";
    if (relativeIndex === images.length - 2) return "prevLeftSecond";
    return relativeIndex > 2 ? "hideRight" : "hideLeft";
  };

  return (
    <div id="carousel-area">
      <div id="carousel">
        {images.map((image, index) => (
          <div className={getClassName(index)} key={index}>
            <div className="img-wrap">
              <span className="img-text">{image.alt}</span>
              <img src={image.src} alt={image.alt} />
            </div>
          </div>
        ))}
      </div>
      <div className="buttons">
        <button className="icon-btn" onClick={() => moveToSelected("prev")}>
          <img src="https://i.postimg.cc/jwWs9zZ1/arrow-L.png" alt="prev" className='icon-img' />
        </button>
        <button className="icon-btn" onClick={() => moveToSelected("next")}>
          <img src="https://i.postimg.cc/k6kndBHg/arrow-R.png" alt="next" className='icon-img' />
        </button>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Carousel />);
